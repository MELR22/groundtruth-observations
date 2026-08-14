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

const gpsStatus = document.getElementById("gpsStatus");
const coordinates = document.getElementById("coordinates");
const saveButton = document.getElementById("save");
const message = document.getElementById("message");
const count = document.getElementById("count");
const typeSelect = document.getElementById("type");
const widthField = document.getElementById("widthField");
const cairnHeightField = document.getElementById("cairnHeightField");
const cairnDiameterField = document.getElementById("cairnDiameterField");
const cairnHeight = document.getElementById("cairnHeight");
const cairnDiameter = document.getElementById("cairnDiameter");
const measurement = document.getElementById("measurement");
const surfaceCondition = document.getElementById("surfaceCondition");
const trailArchitecture = document.getElementById("trailArchitecture");
const wetTrailConditionField = document.getElementById("wetTrailConditionField");
const wetTrailCondition = document.getElementById("wetTrailCondition");
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photoPreview");
const previewImage = document.getElementById("previewImage");
const trackingControls = document.getElementById("trackingControls");
const startTrackingButton = document.getElementById("startTracking");
const stopTrackingButton = document.getElementById("stopTracking");
const trackingStatus = document.getElementById("trackingStatus");

const TRACK_SAMPLE_MS = 500;
const TRACK_MIN_DISTANCE_M = 2;

function setMessage(text, ok = false) {
  message.textContent = text;
  message.style.color = ok ? "#3e7a48" : "#a33a2b";
}

function updateCategoryUI() {
  const observationType = typeSelect.value;

  const widthTypes = ["Trail width", "Track trail"];
  widthField.style.display = widthTypes.includes(observationType) ? "block" : "none";
  if (!widthTypes.includes(observationType)) {
    measurement.value = "";
    surfaceCondition.value = "";
    trailArchitecture.value = "";
  }

  const showWidthExtras = observationType === "Trail width";
  const surfaceLabel = surfaceCondition.previousElementSibling;
  const architectureLabel = trailArchitecture.previousElementSibling;

  surfaceCondition.style.display = showWidthExtras ? "block" : "none";
  if (surfaceLabel) surfaceLabel.style.display = showWidthExtras ? "block" : "none";
  trailArchitecture.style.display = showWidthExtras ? "block" : "none";
  if (architectureLabel) architectureLabel.style.display = showWidthExtras ? "block" : "none";

  if (!showWidthExtras) {
    surfaceCondition.value = "";
    trailArchitecture.value = "";
  }

  wetTrailConditionField.style.display = observationType === "Wet trail" ? "block" : "none";
  if (observationType !== "Wet trail") {
    wetTrailCondition.value = "";
  }

  cairnHeightField.style.display = observationType === "Cairn" ? "block" : "none";
  cairnDiameterField.style.display = observationType === "Cairn" ? "block" : "none";
  if (observationType !== "Cairn") {
    cairnHeight.value = "";
    cairnDiameter.value = "";
  }

  trackingControls.style.display = observationType === "Track trail" ? "block" : "none";
  if (observationType !== "Track trail") {
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
    trackingPolyline = L.polyline(trackingPoints, {
      color: "#f59e0b",
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

function initMap(lat = 69.64, lon = 18.99) {
  map = L.map("map").setView([lat, lon], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Load subzones GeoJSON
  loadSubzones();
}

function loadSubzones() {
  // Fetch the subzone.geojson file
  console.log("Loading subzones from subzone.geojson...");

  fetch("./subzones.geojson")
    .then(response => {
      console.log("Response status:", response.status);
      if (!response.ok) {
        console.error("Failed to load subzone.geojson - file not found or not accessible");
        return null;
      }
      return response.json();
    })
    .then(geojson => {
      if (!geojson) {
        console.warn("No GeoJSON data loaded");
        return;
      }

      console.log("Loaded subzones:", geojson);

      // Style the GeoJSON features
      const subzoneLayer = L.geoJSON(geojson, {
        style: {
          color: "#000000",           // Border color
          weight: 2,                   // Border width
          opacity: 1,                  // Border opacity
          fillColor: "#8b5cf6",        // Fill color (purple)
          fillOpacity: 0.1             // Fill transparency (10%)
        },
        onEachFeature: (feature, layer) => {
          // Add popup with feature properties
          if (feature.properties) {
            const props = Object.entries(feature.properties)
              .map(([key, value]) => `<b>${key}:</b> ${value}`)
              .join("<br>");
            layer.bindPopup(props);
          }
        }
      });

      subzoneLayer.addTo(map);
      console.log("Subzones displayed on map");
    })
    .catch(error => {
      console.error("Error loading subzone.geojson:", error);
    });
}

function updatePosition(position) {
  const { latitude, longitude, accuracy } = position.coords;
  currentPosition = { latitude, longitude, accuracy };

  gpsStatus.textContent = `±${Math.round(accuracy)} m`;
  gpsStatus.style.color = accuracy <= 20 ? "#3e7a48" : "#9a5b00";
  coordinates.textContent =
    `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  if (!map) initMap(latitude, longitude);
  map.setView([latitude, longitude], Math.max(map.getZoom(), 15));

  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.circleMarker([latitude, longitude], {
    radius: 8,
    color: "#2f4249",
    fillColor: "#82b27f",
    fillOpacity: 0.9,
    weight: 3
  }).addTo(map).bindPopup("Your current position");
}

function gpsError(error) {
  gpsStatus.textContent = "GPS unavailable";
  setMessage("Could not get your GPS position. Check location permissions.");
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

  if (o.observation_type === "Track trail") {
    const points = typeof o.track_points === "string"
      ? JSON.parse(o.track_points)
      : (o.track_points || []);

    if (Array.isArray(points) && points.length >= 2) {
      const line = L.polyline(points.map(([lat, lng]) => [lat, lng]), {
        color: "#f59e0b",
        weight: 4,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);

      line.bindPopup(`
        <strong>${escapeHtml(o.group_name)}</strong><br>
        ${escapeHtml(o.observation_type)}<br>
        ${o.measurement ? `<b>Width:</b> ${escapeHtml(o.measurement)} m<br>` : ""}
        ${o.note ? `${escapeHtml(o.note)}<br>` : ""}
        ${photo}
        <small>${date}<br>Route points: ${points.length}</small>
      `);

      markers.push(line);
    }
    return;
  }

  const markerColors = {
    "Trail width": "#ef4444",
    "Cairn": "#3b82f6",
    "Wet trail": "#10b981",
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

  const measurementText =
    o.observation_type === "Trail width" && o.measurement
      ? `<b>Width:</b> ${escapeHtml(o.measurement)} m<br>`
      : "";

  const cairnText =
    o.observation_type === "Cairn"
      ? `${o.cairn_height ? `<b>Height:</b> ${escapeHtml(o.cairn_height)} m<br>` : ""}${o.cairn_diameter ? `<b>Diameter:</b> ${escapeHtml(o.cairn_diameter)} m<br>` : ""}`
      : "";

  marker.bindPopup(`
    <strong>${escapeHtml(o.group_name)}</strong><br>
    ${escapeHtml(o.observation_type)}<br>
    ${measurementText}
    ${cairnText}
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
  const group_name = document.getElementById("group").value;
  const observation_type = document.getElementById("type").value;

  let measurementValue = "";
  let cairnHeightValue = "";
  let cairnDiameterValue = "";
  let surfaceConditionValue = "";
  let trailArchitectureValue = "";
  let wetTrailConditionValue = "";
  let trackData = null;

  if (observation_type === "Trail width" || observation_type === "Track trail") {
    measurementValue = measurement.value.trim();
    surfaceConditionValue = surfaceCondition.value.trim();
    trailArchitectureValue = trailArchitecture.value.trim();
  } else if (observation_type === "Cairn") {
    cairnHeightValue = cairnHeight.value.trim();
    cairnDiameterValue = cairnDiameter.value.trim();
  } else if (observation_type === "Wet trail") {
    wetTrailConditionValue = wetTrailCondition.value.trim();
  }

  if (observation_type === "Track trail") {
    if (trackingPoints.length < 2) {
      setMessage("Please start and finish tracking a route before saving.");
      return;
    }
    trackData = JSON.stringify(trackingPoints);
  }

  if (!note && !measurementValue && !cairnHeightValue && !cairnDiameterValue && !surfaceConditionValue && !trailArchitectureValue && !wetTrailConditionValue && !selectedPhoto && !trackData) {
    setMessage("Please add a measurement, note, photo, or track trail.");
    return;
  }

  if ((observation_type === "Trail width" || observation_type === "Track trail") && !measurementValue) {
    setMessage("Please enter the trail width in metres.");
    return;
  }

  if (observation_type === "Wet trail" && !wetTrailConditionValue) {
    setMessage("Please select the wet trail condition.");
    return;
  }

  if (observation_type === "Cairn" && !cairnHeightValue && !cairnDiameterValue) {
    setMessage("Please enter cairn height and/or diameter in metres.");
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = selectedPhoto ? "Saving photo…" : "Saving…";

  const row = {
    group_name,
    observation_type,
    note,
    measurement: measurementValue,
    cairn_height: cairnHeightValue,
    cairn_diameter: cairnDiameterValue,
    surface_condition: surfaceConditionValue,
    trail_architecture: trailArchitectureValue,
    wet_trail_condition: wetTrailConditionValue,
    latitude: observation_type === "Track trail" ? trackingPoints[0][0] : currentPosition.latitude,
    longitude: observation_type === "Track trail" ? trackingPoints[0][1] : currentPosition.longitude,
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
  measurement.value = "";
  cairnHeight.value = "";
  cairnDiameter.value = "";
  surfaceCondition.value = "";
  trailArchitecture.value = "";
  wetTrailCondition.value = "";
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
startGPS();
loadObservations();
