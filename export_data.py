#!/usr/bin/env python3
"""
Export and process Ground Truth Observations data from Supabase.
"""

import os
import json
import csv
import sys
from datetime import datetime
from pathlib import Path
import requests

from supabase import create_client
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point


def load_config():
    """Load Supabase config from config.js"""
    config_path = Path(__file__).parent / "config.js"
    
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")
    
    # Parse config.js
    with open(config_path, 'r') as f:
        content = f.read()
    
    # Extract SUPABASE_URL
    url_start = content.find('SUPABASE_URL:') + len('SUPABASE_URL: "')
    url_end = content.find('"', url_start)
    supabase_url = content[url_start:url_end]
    
    # Extract SUPABASE_ANON_KEY
    key_start = content.find('SUPABASE_ANON_KEY:') + len('SUPABASE_ANON_KEY: "')
    key_end = content.find('"', key_start)
    supabase_key = content[key_start:key_end]
    
    return {
        "url": supabase_url,
        "key": supabase_key
    }


def download_observations(supabase_client):
    """Download all observations from Supabase"""
    print("Downloading observations...")
    
    response = supabase_client.table("observations").select("*").order("created_at", desc=True).execute()
    
    if response.data:
        print(f"✓ Downloaded {len(response.data)} observations")
        return response.data
    else:
        print("✗ No observations found")
        return []


def download_photos(supabase_client, observations, output_dir="photos"):
    """Download photos for observations"""
    photos_dir = Path(output_dir)
    photos_dir.mkdir(exist_ok=True)
    
    count = 0
    for obs in observations:
        if obs.get("photo_url"):
            try:
                # Extract filename from URL or create one
                photo_filename = f"observation_{obs['id']}.jpg"
                photo_path = photos_dir / photo_filename
                
                # Download the file
                response = requests.get(obs["photo_url"])
                if response.status_code == 200:
                    with open(photo_path, 'wb') as f:
                        f.write(response.content)
                    count += 1
                    print(f"  ✓ Downloaded {photo_filename}")
            except Exception as e:
                print(f"  ✗ Error downloading photo for observation {obs['id']}: {e}")
    
    print(f"✓ Downloaded {count} photos")
    return photos_dir


def export_to_json(observations, output_file="observations.json"):
    """Export observations to JSON"""
    print(f"Exporting to {output_file}...")
    
    with open(output_file, 'w') as f:
        json.dump(observations, f, indent=2, default=str)
    
    print(f"✓ Exported {len(observations)} observations to {output_file}")


def export_by_type(observations, output_dir="by_type"):
    """Export observations separated by type"""
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    by_type = {}
    for obs in observations:
        obs_type = obs.get("observation_type", "Unknown")
        if obs_type not in by_type:
            by_type[obs_type] = []
        by_type[obs_type].append(obs)
    
    for obs_type, obs_list in by_type.items():
        filename = output_path / f"{obs_type.lower().replace(' ', '_')}.csv"
        fieldnames = set()
        for obs in obs_list:
            fieldnames.update(obs.keys())
        fieldnames = sorted(list(fieldnames))
        
        with open(filename, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(obs_list)
        
        print(f"✓ Exported {len(obs_list)} {obs_type} observations to {filename}")


def create_geodataframe(observations, output_file="observations.geojson"):
    """Create a GeoDataFrame and export to GeoJSON"""

    print(f"Creating GeoDataFrame and exporting to {output_file}...")
    
    # Convert to list of dicts with Point geometry
    data = []
    for obs in observations:
        data.append({
            'id': obs.get('id'),
            'group_name': obs.get('group_name'),
            'observation_type': obs.get('observation_type'),
            'measurement': obs.get('measurement'),
            'cairn_height': obs.get('cairn_height'),
            'cairn_diameter': obs.get('cairn_diameter'),
            'surface_condition': obs.get('surface_condition'),
            'trail_architecture': obs.get('trail_architecture'),
            'note': obs.get('note'),
            'gps_accuracy': obs.get('gps_accuracy'),
            'created_at': obs.get('created_at'),
            'photo_url': obs.get('photo_url'),
            'geometry': Point(obs.get('longitude', 0), obs.get('latitude', 0))
        })
    
    # Create GeoDataFrame
    gdf = gpd.GeoDataFrame(data, crs="EPSG:4326")
    
    # Export to GeoJSON
    gdf.to_file(output_file, driver='GeoJSON')
    print(f"✓ Created GeoDataFrame with {len(gdf)} observations")
    print(f"✓ Exported to {output_file}")
    
    return gdf


def print_summary(observations):
    """Print a summary of observations"""
    print("\n" + "="*50)
    print("SUMMARY")
    print("="*50)
    print(f"Total observations: {len(observations)}")
    
    # Count by type
    by_type = {}
    for obs in observations:
        obs_type = obs.get("observation_type", "Unknown")
        by_type[obs_type] = by_type.get(obs_type, 0) + 1
    
    print("\nBy type:")
    for obs_type, count in sorted(by_type.items()):
        print(f"  {obs_type}: {count}")
    
    # Count by group
    by_group = {}
    for obs in observations:
        group = obs.get("group_name", "Unknown")
        by_group[group] = by_group.get(group, 0) + 1
    
    print("\nBy group:")
    for group, count in sorted(by_group.items()):
        print(f"  {group}: {count}")
    
    # Photos
    with_photos = sum(1 for obs in observations if obs.get("photo_url"))
    print(f"\nObservations with photos: {with_photos}")
    
    print("="*50 + "\n")


def main():
    print("Ground Truth Observations - Data Export Tool\n")
    
    try:
        # Load configuration
        config = load_config()
        print(f"✓ Loaded Supabase config")
        print(f"  URL: {config['url']}\n")
        
        # Connect to Supabase
        supabase = create_client(config["url"], config["key"])
        
        # Download data
        observations = download_observations(supabase)
        
        if not observations:
            print("No data to export")
            return
        
        # Export data
        print("\nExporting data...")
        #export_to_json(observations)
        #export_by_type(observations)
        
        # Create GeoDataFrame
        try:
            gpd = create_geodataframe(observations)
        except Exception as e:
            print(f"✗ Error creating GeoDataFrame: {e}")

        gpd.to_file("bla.shp")
        # Download photos
        try:
            download_photos(supabase, observations)
        except Exception as e:
            print(f"✗ Error downloading photos: {e}")
        
        # Print summary
        print_summary(observations)
        
    except FileNotFoundError as e:
        print(f"✗ Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
