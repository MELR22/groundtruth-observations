#%%
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
import matplotlib.patheffects as pe
import matplotlib.lines as mlines
import contextily as ctx
import geopandas as gpd

API_CARTODBN = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png?key=cb1_44jv_1_de17fd6db751b9d201748b36"

def get_logo():
    # Get a path-like object
    #  to the file inside the package
    logo_path = r".\by_type\logo_green.png"
    return mpimg.imread(logo_path)


def annotate_cairns(ax, cairns_gdf, text_color="#23313d", fontsize=7):
    """Annotate cairn points with their ID values."""
    if cairns_gdf.empty:
        return

    for _, row in cairns_gdf.iterrows():
        if row.geometry is None or row.geometry.is_empty:
            continue

        label = row["id"] if "id" in cairns_gdf.columns else row.name
        x, y = row.geometry.x, row.geometry.y
        ax.annotate(
            str(label),
            xy=(x, y),
            xytext=(4, 4),
            textcoords="offset points",
            fontsize=fontsize,
            color=text_color,
            zorder=5,
        )


#
path_fainttrails = r"./by_type/fainttrails.geojson"
path_cairns = r"./by_type/cairns.geojson"
fainttrails = gpd.read_file(path_fainttrails)
cairns = gpd.read_file(path_cairns)


# Instagram portrait ratio: 4:5 (e.g. 1080x1350 px)
fig, ax = plt.subplots(dpi=400, figsize=(4.5, 5.625), facecolor="#edf3f7")

# Soft shadow behind the trail geometry so it pops off the basemap.
shadow = fainttrails.plot(
    ax=ax,
    color="#3b1c1a",
    edgecolor="#214d3d",
    linewidth=1.4,
    alpha=0.2,
    zorder=2,
)

fainttrails.plot(
    ax=ax,
    color="#C71919D5",
    edgecolor="#214d3d",
    linewidth=1.2,
    alpha=0.9,
    zorder=3,
    label="Faint trails",
)

cairns.plot(
    ax=ax,
    color="#81B080",
    edgecolor="#214d3d",
    marker="^",
    alpha=0.9,
    zorder=3,
    label="Cairns",
)

legend_handles = [
    mlines.Line2D(
        [0], [0],
        color="#C71919D5",
        lw=2,
        label="Faint trails",
    ),
    mlines.Line2D(
        [0], [0],
        linestyle="",
        marker="^",
        markerfacecolor="#81B080",
        markeredgecolor="#214d3d",
        markersize=7,
        label="Cairns",
    ),
]

legend = ax.legend(
    handles=legend_handles,
    loc="upper left",
    bbox_to_anchor=(0.01, 0.99),
    frameon=False,
    fontsize=7,
    labelcolor="#23313d",
)
for text in legend.get_texts():
    text.set_color("#23313d")
osm_provider = ctx.providers.OpenStreetMap.Mapnik.copy()

# Set map extent based on the bounds of the fainttrails dataset
minx, miny, maxx, maxy = fainttrails.total_bounds
ax.set_xlim(minx, maxx)
ax.set_ylim(miny, maxy)

# nice map styling
ax.set_facecolor("#edf3f7")
fig.patch.set_facecolor("#edf3f7")

ctx.add_basemap(
    ax,
    source=osm_provider,
    crs=fainttrails.crs.to_string(),
    attribution=False,
    headers={"User-Agent": "FloyaMap/1.0 (contact: r.melman@gmail.com)"},
    alpha=0.9,
    zorder=1,
    # zoom=18,
)

ax.set_axis_off()
for spine in ax.spines.values():
    spine.set_visible(False)

ax.annotate(
    "N",
    xy=(0.97, 0.96),
    xycoords="axes fraction",
    ha="center",
    va="center",
    fontsize=8,
    fontweight="bold",
    color="#23313d",
    zorder=5,
)

ax.annotate(
    "",
    xy=(0.97, 0.95),
    xytext=(0.97, 0.88),
    xycoords="axes fraction",
    arrowprops=dict(
        arrowstyle="-|>",
        lw=1.2,
        color="#23313d",
        mutation_scale=8,
        shrinkA=0,
        shrinkB=0,
    ),
    zorder=5,
)


logo = get_logo()
#fig = ax.get_figure()
logo_ax = fig.add_axes([0.2, 0.03, 0.15, 0.15], anchor="SE")
logo_ax.imshow(logo)
logo_ax.axis("off")
plt.tight_layout()



# %%
path_wettrails = r"./by_type/wettrails.geojson"
wettrails = gpd.read_file(path_wettrails).drop(index=[38, 39, 45], errors="ignore")
wettrails["wet_trail_condition"] = wettrails["wet_trail_condition"].fillna("Muddy")

colors = {
    "Muddy": "#75685C",
    "Water standing": "#303D4B",
    "Water running": "#C71919D5",
    "Running water": "#C71919D5",
}

wettrails["color"] = wettrails["wet_trail_condition"].map(colors)
# Instagram portrait ratio: 4:5 (e.g. 1080x1350 px)
fig, ax = plt.subplots(dpi=800, figsize=(4.5, 5.625), facecolor="#edf3f7")

ax.scatter(
    x=18.9962,
    y=69.6357,
    c="#000000",
    marker="^",
    s=50,
    zorder=4,
)
ax.text(
    x=18.9962+0.0005,
    y=69.6357,
    s="Fjellheisen",
    fontsize=7,
)

ax.scatter(
    x=18.9965,
    y=69.624,
    c="#000000",
    marker="^",
    s=50,
    zorder=4,
)
ax.text(
    x=18.996+0.001,
    y=69.624,
    s="Fløya Summit",
    fontsize=7,
)
wettrails.plot(
    ax=ax,
    c=wettrails["color"],
    marker=".",
    alpha=0.9,
    zorder=3,
    label="Cairns",
)

for i, row in wettrails.iterrows():
    if row.geometry is None or row.geometry.is_empty:
        continue

    label = row["observation_id"] 
    x, y = row.geometry.x, row.geometry.y
    ax.annotate(
        str(label),
        xy=(x, y),
        xytext=(4, 4),
        textcoords="offset points",
        fontsize=7,
        color="#23313d",
        zorder=5,
    )

minx, miny, maxx, maxy = wettrails.total_bounds
ax.set_xlim(minx-0.007, maxx+0.007)


handles = [
    mlines.Line2D(
        [],
        [],
        color=color,
        marker=".",
        linestyle="",
        label=condition,
    )
    for condition, color in list(colors.items())[:3]
]
ax.legend(
    handles=handles,
    loc="upper left",
    frameon=False,
    fontsize=7,
    labelcolor="#23313d",
)

ax.set_facecolor("#edf3f7")
fig.patch.set_facecolor("#edf3f7")



ctx.add_basemap(
    ax,
    source=API_CARTODBN,
    crs=wettrails.crs.to_string(),
    attribution=False,
    alpha=0.9,
    zorder=1,
    # zoom=18,
)


ax.set_axis_off()
for spine in ax.spines.values():
    spine.set_visible(False)

ax.annotate(
    "N",
    xy=(0.97, 0.96),
    xycoords="axes fraction",
    ha="center",
    va="center",
    fontsize=8,
    fontweight="bold",
    color="#23313d",
    zorder=5,
)

ax.annotate(
    "",
    xy=(0.97, 0.95),
    xytext=(0.97, 0.88),
    xycoords="axes fraction",
    arrowprops=dict(
        arrowstyle="-|>",
        lw=1.2,
        color="#23313d",
        mutation_scale=8,
        shrinkA=0,
        shrinkB=0,
    ),
    zorder=5,
)

ax.patch.set_alpha(0.0)
fig.patch.set_alpha(0.0)

logo = get_logo()
#fig = ax.get_figure()
logo_ax = fig.add_axes([0.14, 0.12, 0.15, 0.15], anchor="SE")
logo_ax.imshow(logo)
logo_ax.axis("off")


# %%
