#%%
import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, MultiLineString, Point
import matplotlib.pyplot as plt

def filter_linestring_points(geometry, max_distance=20):
    if geometry is None or geometry.is_empty:
        return geometry

    if geometry.geom_type == "LineString":
        coords = list(geometry.coords)
        if len(coords) < 2:
            return geometry

        filtered_coords = [coords[0]]
        previous = coords[0]

        for coord in coords[1:]:
            current = Point(coord)
            
            if current.distance(Point(previous)) <= max_distance:
                filtered_coords.append(coord)
                #print(current.distance(Point(previous)))
            previous = coord


        return LineString(filtered_coords)

    if geometry.geom_type == "MultiLineString":
        filtered_parts = []
        for part in geometry.geoms:
            filtered_part = filter_linestring_points(part, max_distance=max_distance)
            if filtered_part is not None and not filtered_part.is_empty:
                filtered_parts.append(filtered_part)

        return MultiLineString(filtered_parts)

    return geometry


#%% wet trails
dates = ["20260815", "20260912", "20260920"]
types = ["Wet trail", "Mark wet trail"]


wetTrails = gpd.GeoDataFrame()
for date, type in zip(dates, types):

    path_observations = fr'./{date}_data/observations.geojson'
    observations = gpd.read_file(path_observations)

    temp = observations[observations["observation_type"] == type]

    columns_wt = ['id', 'wet_trail_condition', 'note', 'gps_accuracy', 'created_at','geometry']

    temp["id"] = date + "_" + temp["id"].astype(str)
    temp = temp[columns_wt]
    wetTrails = pd.concat([wetTrails, temp], ignore_index=True)

wetTrails = wetTrails.rename(columns={"id":"observation_id"})
wetTrails = wetTrails.sort_values(by="created_at").reset_index(drop=True)

wetTrails.to_file(
    fr"./by_type/wettrails.geojson",
    driver="GeoJSON"
)

#%% trail width
path_observations = fr'./20260815_data/observations.geojson'
observations = gpd.read_file(path_observations)

trailWidth = observations[observations["observation_type"] == "Trail width"]

columns_tw = ['id', 'measurement', 'surface_condition', 'trail_architecture', 'note', 'gps_accuracy', 'created_at', 'photo_url','geometry']
trailWidth = trailWidth[columns_tw]
trailWidth = trailWidth.rename(columns={"id":"observation_id", "measurement":"trail_width (m)"})
trailWidth["trail_width (m)"] = trailWidth["trail_width (m)"].astype(float)
trailWidth = trailWidth.sort_values(by="observation_id").reset_index(drop=True)
trailWidth.to_file(
    r"./by_type/20260815_trailwidth.geojson",
    driver="GeoJSON"
)


# %% erosion features

columns_cr = ['id', 'cairn_height', 'cairn_diameter', 'note', 'gps_accuracy', 'created_at', 'photo_url','geometry']

columns_ef = ['id', 'erosion_feature', 'note', 'gps_accuracy', 'created_at', 'photo_url','geometry']

# 20260815
path_observations = fr'./20260815_data/observations.geojson'
observations = gpd.read_file(path_observations)
cairns_1 = observations[observations["observation_type"] == "Cairn"]
cairns_1 = cairns_1[columns_cr]
cairns_1["id"] = "20260815_" + cairns_1["id"].astype(str)
erosionFeatures_1 = observations[observations["observation_type"] == "Mark erosion"]

# 20260912
path_observations = fr'./20260912_data/observations.geojson'
observations = gpd.read_file(path_observations)
erosionFeatures_2 = observations[observations["observation_type"] == "Mark erosion"]

# 20260920
path_observations = fr'./20260920_data/observations.geojson'
observations = gpd.read_file(path_observations)
erosionFeatures_3 = observations[observations["observation_type"] == "Mark erosion"]

# cairns
cairns_2 = erosionFeatures_3[erosionFeatures_3["note"] == "Cairn"]
cairns_2["id"] = "20260815_" + cairns_2["id"].astype(str)
cairns_2 = cairns_2[['id', 'note', 'gps_accuracy', 'created_at', 'photo_url','geometry']]

cairns = pd.concat([cairns_1, cairns_2], ignore_index=True)
cairns = cairns.sort_values("created_at")
cairns.to_file(
    r"./by_type/cairns.geojson",
    driver="GeoJSON",
    index=False
)

# other erosion features
erosionFeatures_3 = erosionFeatures_3[erosionFeatures_3["note"] != "Cairn"]
erosionFeatures = pd.concat([erosionFeatures_2, erosionFeatures_3], ignore_index=True)
erosionFeatures = erosionFeatures[columns_ef]
erosionFeatures["id"] =  erosionFeatures["created_at"].dt.strftime("%Y%m%d") + "_" + erosionFeatures["id"].astype(str)

erosionFeatures = erosionFeatures.sort_values("created_at")
erosionFeatures.to_file(
    r"./by_type/erosionfeatures.geojson",
    driver="GeoJSON",
    index=False
)

erosionFeatures["id"] =  "20260912_" + erosionFeatures["id"].astype(str)
erosionFeatures = erosionFeatures.rename(columns={"id":"observation_id"})
erosionFeatures = erosionFeatures.sort_values(by="created_at").reset_index(drop=True)
erosionFeatures.to_file(
    r"./by_type/20260912_erosionfeatures.geojson",
    driver="GeoJSON"
)


#%% fain trails
columns_ft = ['id', 'note', 'gps_accuracy', 'created_at', 'photo_url','geometry']

# 20260815
path_tracks = r'./20260815_data/20260815_track_trails.geojson'
faintTrails_1 = gpd.read_file(path_tracks)
faintTrails_1 = faintTrails_1.drop(index=[1, 59], errors="ignore")
faintTrails_1 = faintTrails_1[columns_ft]
faintTrails_1["id"] =  "20260815_" + faintTrails_1["id"].astype(str)

# 20260912
path_tracks = r'./20260912_data/track_trails.geojson'
tracks = gpd.read_file(path_tracks)
faintTrails_2 = tracks[tracks["observation_type"] == "Track faint trails"]
faintTrails_2 = faintTrails_2[columns_ft]
faintTrails_2["id"] =  "20260912_" + faintTrails_2["id"].astype(str)

#20260920
path_tracks = r'./20260920_data/track_trails.geojson'
tracks = gpd.read_file(path_tracks)
faintTrails_3 = tracks[tracks["observation_type"] == "Track faint trails"]
faintTrails_3 = faintTrails_3[columns_ft]
faintTrails_3["id"] =  "20260920_" + faintTrails_3["id"].astype(str)


faintTrails = pd.concat([faintTrails_1, faintTrails_2, faintTrails_3], ignore_index=True)

faintTrails = faintTrails.to_crs(faintTrails.estimate_utm_crs())
for i, row in faintTrails.iterrows():
    print(i)
    filter_linestring_points(row["geometry"])

faintTrails["geometry"] = faintTrails["geometry"].apply(filter_linestring_points)
faintTrails = faintTrails.to_crs("EPSG:4326")
faintTrails.to_file(
    r"./by_type/fainttrails.geojson",
    driver="GeoJSON"
)



# %% > 1m wide trails


wideTrails = tracks[tracks["observation_type"] == "Track >1 m wide sections"]


columns_ft = ['id', 'note', 'gps_accuracy', 'created_at', 'photo_url','geometry']
wideTrails = wideTrails[columns_ft]
wideTrails = wideTrails.to_crs(wideTrails.estimate_utm_crs())
wideTrails["geometry"] = wideTrails["geometry"].apply(filter_linestring_points)
wideTrails = wideTrails.to_crs("EPSG:4326")
wideTrails["id"] =  "20260912_" + wideTrails["id"].astype(str)
wideTrails.to_file(
    r"./by_type/20260912_widetrails.geojson",
    driver="GeoJSON"
)


# %%
