#%%
import geopandas as gpd

path_observations = r'./data/observations.geojson'

observations = gpd.read_file(path_observations)

wetTrails = observations[observations["observation_type"] == "Wet trail"]

columns_wt = ['id',       'wet_trail_condition', 'note', 'gps_accuracy', 'created_at', 'photo_url',
       'geometry']
wetTrails = wetTrails[columns_wt]
wetTrails = wetTrails.rename(columns={"id":"observation_id"})
wetTrails = wetTrails.sort_values(by="observation_id").reset_index(drop=True)
wetTrails.to_file(
    r"./by_type/20260815_wettrails.geojson",
    driver="GeoJSON"
)

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


# %%
