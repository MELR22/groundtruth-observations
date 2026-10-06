#%%
import matplotlib.pyplot as plt

data_fjellheisen = {
    1965: 30_000, # https://www.facebook.com/Fjellheisen/posts/nostalgifjellheisen-%C3%A5pnet-i-februar-1961-og-var-da-prim%C3%A6rt-et-tilbud-til-byens-b/1524779800878632/
    2017: 150_000,
    2025: 250_000, # https://www.fjellheisen.no/om-fjellheisen/

}

fig, ax = plt.subplots(dpi=400, figsize=(4.5, 5.625), facecolor="none")

points = list(data_fjellheisen.items())
xs = [year for year, _ in points]
ys = [value for _, value in points]

ax.plot(
    xs,
    ys,
    color="#F0F0F0",
    marker="o",
    markersize=9,
    markerfacecolor="#F7F8F9",
    markeredgecolor="#F0F0F0",
    markeredgewidth=2,
    linewidth=1.2,
)

for year, value in points:
    ax.annotate(
        f"{value:.0f}",
        (year, value),
        xytext=(0, 8),
        textcoords="offset points",
        ha="center",
        va="bottom",
        fontsize=9,
        color="#F0F0F0",
    )

ax.set_xlim(min(xs) - 10, max(xs) + 10)
ax.set_ylim(0, 275000)
ax.set_yticks([])
ax.tick_params(axis="x", colors="#F0F0F0", labelsize=9)
for spine in ax.spines.values():
    spine.set_visible(False)
fig.patch.set_alpha(0)


plt.savefig(r'D:\OneDrive\Documenten\Roel_Werk\Tromso\RissaCS\Fløya\fjellheis-use.png', format='png', dpi=600, transparent=True)
plt.show()



# %%
