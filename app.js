const config = window.APP_CONFIG || {};
const configured =
  config.SUPABASE_URL &&
  config.SUPABASE_ANON_KEY &&
  !config.SUPABASE_URL.includes("YOUR_") &&
  !config.SUPABASE_ANON_KEY.includes("YOUR_");

const supabaseClient = configured
  ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
  : null;

let currentPosition = null;
let map = null;
let markers = [];
let userMarker = null;
let selectedPhoto = null;
let trackingTimer = null;
let trackingPoints = [];
let trackingPolyline = null;
let initialLocationCentered = false;

const gpsStatus = document.getElementById("gpsStatus");
const coordinates = document.getElementById("coordinates");
const saveButton = document.getElementById("save");
const message = document.getElementById("message");
const count = document.getElementById("count");
const typeSelect = document.getElementById("type");
const widthField = document.getElementById("widthField");
const widthCategory = document.getElementById("widthCategory");
const wetTrailConditionField = document.getElementById("wetTrailConditionField");
const wetTrailCondition = document.getElementById("wetTrailCondition");
const erosionTypeField = document.getElementById("erosionTypeField");
const erosionType = document.getElementById("erosionType");
const photoInput = document.getElementById("photo");
const photoButton = document.getElementById("photoButton");
const photoPreview = document.getElementById("photoPreview");
const previewImage = document.getElementById("previewImage");
const trackingControls = document.getElementById("trackingControls");
const startTrackingButton = document.getElementById("startTracking");
const stopTrackingButton = document.getElementById("stopTracking");
const trackingStatus = document.getElementById("trackingStatus");
const myLocationButton = document.getElementById("myLocationButton");

const TRACK_SAMPLE_MS = 500;
const TRACK_MIN_DISTANCE_M = 2;

const TASK_GEOJSONS = [
  { file: "tasks/GT_task1.geojson", color: "#2563eb", label: "Task 1", dashed: true },
  { file: "tasks/GT_task2.geojson", color: "#16a34a", label: "Task 2", dashed: true }
];

const TRACKING_TASKS = [
  "Track >1 m wide sections",
  "Track and measure width",
  "Track faint trails"
];

const TRACKING_TASK_COLORS = {
  "Track >1 m wide sections": "#2563eb",
  "Track and measure width": "#16a34a",
  "Track faint trails": "#8b5cf6"
};

const POINT_OBSERVATION_COLORS = {
  "Mark wet trail": "#10b981",
  "Mark erosion": "#f59e0b"
};

let taskLayers = [];

function normalizeDecimalInput(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(",", ".").trim();
}

function sanitizeNumericField(field) {
  if (!field) return "";
  const normalized = normalizeDecimalInput(field.value);
  field.value = normalized;
  return normalized;
}

function setMessage(text, ok = false) {
  message.textContent = text;
  message.style.color = ok ? "#3e7a48" : "#a33a2b";
}

function updateCategoryUI() {
  const observationType = typeSelect.value;

  const showWidthField = observationType === "Track and measure width";
  widthField.style.display = showWidthField ? "block" : "none";
  if (!showWidthField) {
    widthCategory.value = "";
  }

  const showWetTrailField = observationType === "Mark wet trail";
  wetTrailConditionField.style.display = showWetTrailField ? "block" : "none";
  if (!showWetTrailField) {
    wetTrailCondition.value = "";
  }

  const showErosionField = observationType === "Mark erosion";
  erosionTypeField.style.display = showErosionField ? "block" : "none";
  if (!showErosionField) {
    erosionType.value = "";
  }

  const trackingTasks = ["Track >1 m wide sections", "Track and measure width", "Track faint trails"];
  trackingControls.style.display = trackingTasks.includes(observationType) ? "block" : "none";
  if (!trackingTasks.includes(observationType)) {
    stopTracking();
  }
}
typeSelect.addEventListener("change", updateCategoryUI);
updateCategoryUI();

function distanceBetweenPoints(a, b) {
  const toRad = value => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);

  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * 1000 * Math.asin(Math.sqrt(hav));
}

function renderTrackingLine() {
  if (trackingPolyline) {
    map.removeLayer(trackingPolyline);
  }

  if (trackingPoints.length >= 2 && map) {
    const lineColor = TRACKING_TASK_COLORS[typeSelect.value] || "#f59e0b";

    trackingPolyline = L.polyline(trackingPoints, {
      color: lineColor,
      weight: 4,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);
  }
}

function stopTracking() {
  if (trackingTimer) {
    clearInterval(trackingTimer);
    trackingTimer = null;
  }

  startTrackingButton.disabled = false;
  stopTrackingButton.disabled = true;

  if (trackingPoints.length > 1) {
    trackingStatus.textContent = `Route complete: ${trackingPoints.length} points captured`;
    trackingStatus.style.color = "#3e7a48";
    trackingStatus.style.fontWeight = "700";
  } else {
    trackingStatus.textContent = "No route in progress";
    trackingStatus.style.color = "#858995";
    trackingStatus.style.fontWeight = "500";
  }

  if (trackingPoints.length >= 2 && map) {
    renderTrackingLine();
  }
}

function startTracking() {
  if (!navigator.geolocation) {
    setMessage("GPS is not supported in this browser.");
    return;
  }

  if (!currentPosition) {
    setMessage("Waiting for a GPS fix before starting a track trail.");
    return;
  }

  trackingPoints = [[currentPosition.latitude, currentPosition.longitude]];
  renderTrackingLine();

  trackingStatus.textContent = "Tracking in progress…";
  trackingStatus.style.color = "#9a5b00";
  trackingStatus.style.fontWeight = "700";
  startTrackingButton.disabled = true;
  stopTrackingButton.disabled = false;

  trackingTimer = setInterval(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const latest = trackingPoints[trackingPoints.length - 1];
      if (!latest || distanceBetweenPoints(latest, [lat, lng]) > TRACK_MIN_DISTANCE_M) {
        trackingPoints.push([lat, lng]);
        renderTrackingLine();
        trackingStatus.textContent = `Tracking in progress… ${trackingPoints.length} points`;
      }
    }, gpsError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 15000
    });
  }, TRACK_SAMPLE_MS);
}

startTrackingButton.addEventListener("click", startTracking);
stopTrackingButton.addEventListener("click", () => {
  stopTracking();
});
myLocationButton?.addEventListener("click", goToMyLocation);

function initMap(lat = 69.64, lon = 18.99) {
  map = L.map("map").setView([lat, lon], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}

async function loadTaskLayers() {
  if (!map) return;

  taskLayers.forEach(layer => map.removeLayer(layer));
  taskLayers = [];

  try {
    const layers = await Promise.all(
      TASK_GEOJSONS.map(async ({ file, color, label, dashed }) => {
        const response = await fetch(file);
        if (!response.ok) {
          throw new Error(`Failed to load ${file}: ${response.status}`);
        }

        const data = await response.json();

        const layer = L.geoJSON(data, {
          style: () => ({
            color,
            weight: 4,
            opacity: 0.9,
            fillOpacity: 0.15,
            dashArray: dashed ? "10 10" : null,
            lineCap: "round",
            lineJoin: "round"
          }),
          onEachFeature: (feature, currentLayer) => {
            const props = feature.properties || {};
            const description = props.name || props.Name || props.label || props.Label || label;
            currentLayer.bindPopup(`<strong>${label}</strong><br>${escapeHtml(description)}`);
          }
        }).addTo(map);

        return layer;
      })
    );

    taskLayers = layers;

    const allBounds = taskLayers.reduce((combinedBounds, layer) => {
      const bounds = layer.getBounds();
      return combinedBounds ? combinedBounds.extend(bounds) : bounds;
    }, null);

    if (allBounds && allBounds.isValid()) {
      map.fitBounds(allBounds, { padding: [30, 30], maxZoom: 15 });
    }
  } catch (error) {
    console.error(error);
    setMessage("Could not load the task GeoJSON files.");
  }
}

function updatePosition(position) {
  const { latitude, longitude, accuracy } = position.coords;
  currentPosition = { latitude, longitude, accuracy };

  gpsStatus.textContent = `±${Math.round(accuracy)} m`;
  gpsStatus.style.color = accuracy <= 20 ? "#3e7a48" : "#9a5b00";
  coordinates.textContent =
    `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  if (!map) initMap(latitude, longitude);

  if (!initialLocationCentered && map) {
    map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
    initialLocationCentered = true;
  }

  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.circleMarker([latitude, longitude], {
    radius: 8,
    color: "#2563eb",
    fillColor: "#93c5fd",
    fillOpacity: 0.95,
    weight: 3
  }).addTo(map).bindPopup("Your current position");
}

function gpsError(error) {
  gpsStatus.textContent = "GPS unavailable";
  setMessage("Could not get your GPS position. Check location permissions.");
}

function goToMyLocation() {
  if (!currentPosition) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updatePosition(position);
        if (map && currentPosition) {
          map.flyTo([currentPosition.latitude, currentPosition.longitude], Math.max(map.getZoom(), 15));
        }
      },
      gpsError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );
    return;
  }

  if (map) {
    map.flyTo([currentPosition.latitude, currentPosition.longitude], Math.max(map.getZoom(), 15));
  }
}

function startGPS() {
  if (!navigator.geolocation) {
    gpsStatus.textContent = "GPS not supported";
    return;
  }
  navigator.geolocation.watchPosition(updatePosition, gpsError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000
  });
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  if (!file) return;

  selectedPhoto = file;
  previewImage.src = URL.createObjectURL(file);
  photoPreview.classList.remove("hidden");
  message.textContent = "";
});

document.getElementById("removePhoto").addEventListener("click", () => {
  selectedPhoto = null;
  photoInput.value = "";
  previewImage.removeAttribute("src");
  photoPreview.classList.add("hidden");
});

async function compressPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const maxSize = 800;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise(resolve =>
    canvas.toBlob(resolve, "image/jpeg", 0.82)
  );
}


async function uploadPhoto(file, observationId) {
  const blob = await compressPhoto(file);
  const path = `${observationId}/${Date.now()}.jpg`;

  const { error } = await supabaseClient
    .storage
    .from("observation-photos")
    .upload(path, blob, {
      contentType: "image/jpeg",
      upsert: false
    });

  if (error) throw error;

  const { data } = supabaseClient
    .storage
    .from("observation-photos")
    .getPublicUrl(path);

  return data.publicUrl;
}

async function loadObservations() {
  if (!supabaseClient) {
    count.textContent = "?";
    return;
  }

  const { data, error } = await supabaseClient
    .from("observations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    setMessage("Could not load observations.");
    return;
  }

  markers.forEach(m => map && map.removeLayer(m));
  markers = [];

  if (!map && data.length) initMap(data[0].latitude, data[0].longitude);
  if (!map) initMap();

  data.forEach(addMarker);
  count.textContent = data.length;
}

function addMarker(o) {
  if (!map) initMap(o.latitude, o.longitude);

  const date = new Date(o.created_at).toLocaleString();
  const photo = o.photo_url
    ? `<img class="popup-photo" src="${escapeAttr(o.photo_url)}" alt="Observation photo">`
    : "";

  if (TRACKING_TASKS.includes(o.observation_type)) {
    const points = typeof o.track_points === "string"
      ? JSON.parse(o.track_points)
      : (o.track_points || []);

    if (Array.isArray(points) && points.length >= 2) {
      const line = L.polyline(points.map(([lat, lng]) => [lat, lng]), {
        color: TRACKING_TASK_COLORS[o.observation_type] || "#3b82f6",
        weight: 4,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);

      line.bindPopup(`
        <strong>${escapeHtml(o.group_name)}</strong><br>
        ${escapeHtml(o.observation_type)}<br>
        ${o.measurement ? `<b>Width:</b> ${escapeHtml(o.measurement)}<br>` : ""}
        ${o.note ? `${escapeHtml(o.note)}<br>` : ""}
        ${photo}
        <small>${date}<br>Route points: ${points.length}</small>
      `);

      markers.push(line);
    }
    return;
  }

  const markerColors = {
    "Mark wet trail": "#10b981",
    "Mark erosion": "#f59e0b",
    "default": "#6b7280"
  };
  const markerColor = markerColors[o.observation_type] || markerColors["default"];

  const marker = L.circleMarker([o.latitude, o.longitude], {
    radius: 8,
    color: markerColor,
    fillColor: markerColor,
    fillOpacity: 0.7,
    weight: 2
  }).addTo(map);

  const widthText =
    o.observation_type === "Track and measure width" && o.measurement
      ? `<b>Width:</b> ${escapeHtml(o.measurement)}<br>`
      : "";

  const wetTrailText =
    o.observation_type === "Mark wet trail" && o.wet_trail_condition
      ? `<b>Condition:</b> ${escapeHtml(o.wet_trail_condition)}<br>`
      : "";

  const erosionText =
    o.observation_type === "Mark erosion" && o.erosion_feature
      ? `<b>Erosion type:</b> ${escapeHtml(o.erosion_feature)}<br>`
      : "";

  marker.bindPopup(`
    <strong>${escapeHtml(o.group_name)}</strong><br>
    ${escapeHtml(o.observation_type)}<br>
    ${widthText}
    ${wetTrailText}
    ${erosionText}
    ${o.note ? `${escapeHtml(o.note)}<br>` : ""}
    ${photo}
    <small>${date}<br>GPS accuracy: ${Math.round(o.gps_accuracy)} m</small>
  `);

  markers.push(marker);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  }[c]));
}

function escapeAttr(value) {
  return String(value ?? "").replace(/["&<>]/g, c => ({
    '"': "&quot;", "&": "&amp;", "<": "&lt;", ">": "&gt;"
  }[c]));
}

saveButton.addEventListener("click", async () => {
  if (!configured) {
    setMessage("Supabase is not configured yet. See SETUP.md.");
    return;
  }

  if (!currentPosition) {
    setMessage("Waiting for GPS position…");
    return;
  }

  const note = document.getElementById("note").value.trim();
  const group_name = "Group 1";
  const observation_type = document.getElementById("type").value;

  let widthCategoryValue = "";
  let wetTrailConditionValue = "";
  let erosionTypeValue = "";
  let trackData = null;

  if (observation_type === "Track and measure width") {
    widthCategoryValue = widthCategory.value.trim();
  } else if (observation_type === "Mark wet trail") {
    wetTrailConditionValue = wetTrailCondition.value.trim();
  } else if (observation_type === "Mark erosion") {
    erosionTypeValue = erosionType.value.trim();
  }

  if (TRACKING_TASKS.includes(observation_type)) {
    if (trackingPoints.length < 2) {
      setMessage("Please start and finish tracking a route before saving.");
      return;
    }
    trackData = JSON.stringify(trackingPoints);
  }

  if (!note && !widthCategoryValue && !wetTrailConditionValue && !erosionTypeValue && !selectedPhoto && !trackData) {
    setMessage("Please add a remark, photo, or tracked route before saving.");
    return;
  }

  if (observation_type === "Track and measure width" && !widthCategoryValue) {
    setMessage("Please select the trail width category.");
    return;
  }

  if (observation_type === "Mark wet trail" && !wetTrailConditionValue) {
    setMessage("Please select the wet trail condition.");
    return;
  }

  if (observation_type === "Mark erosion" && !erosionTypeValue) {
    setMessage("Please select the erosion type.");
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = selectedPhoto ? "Saving photo…" : "Saving…";

  const row = {
    group_name,
    observation_type,
    note,
    measurement: widthCategoryValue,
    wet_trail_condition: wetTrailConditionValue,
    erosion_feature: erosionTypeValue,
    latitude: TRACKING_TASKS.includes(observation_type) ? trackingPoints[0][0] : currentPosition.latitude,
    longitude: TRACKING_TASKS.includes(observation_type) ? trackingPoints[0][1] : currentPosition.longitude,
    gps_accuracy: currentPosition.accuracy,
    track_points: trackData
  };

  const { data, error } = await supabaseClient
    .from("observations")
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error(error);
    saveButton.disabled = false;
    saveButton.textContent = "Save observation";
    setMessage(`Save failed: ${error.message}`);
    return;
  }

  let finalData = data;

  if (selectedPhoto) {
    try {
      saveButton.textContent = "Uploading photo…";
      const photoUrl = await uploadPhoto(selectedPhoto, data.id);

      const { data: updated, error: updateError } = await supabaseClient
        .from("observations")
        .update({ photo_url: photoUrl })
        .eq("id", data.id)
        .select()
        .single();

      if (updateError) throw updateError;
      finalData = updated;
    } catch (photoError) {
      console.error(photoError);
      setMessage("Observation saved, but photo upload failed.");
    }
  }

  addMarker(finalData);
  count.textContent = Number(count.textContent || 0) + 1;

  document.getElementById("note").value = "";
  widthCategory.value = "";
  wetTrailCondition.value = "";
  erosionType.value = "";
  trackingPoints = [];
  if (trackingPolyline) {
    map.removeLayer(trackingPolyline);
    trackingPolyline = null;
  }
  trackingStatus.textContent = "No route in progress";
  trackingStatus.style.color = "#858995";
  trackingStatus.style.fontWeight = "500";
  stopTrackingButton.disabled = true;
  startTrackingButton.disabled = false;
  selectedPhoto = null;
  photoInput.value = "";
  previewImage.removeAttribute("src");
  photoPreview.classList.add("hidden");

  saveButton.disabled = false;
  saveButton.textContent = "Save observation";

  if (!message.textContent.includes("photo upload failed")) {
    setMessage("Observation saved!", true);
  }
});

initMap();
loadTaskLayers();
startGPS();
loadObservations();
