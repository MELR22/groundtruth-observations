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

const gpsStatus = document.getElementById("gpsStatus");
const coordinates = document.getElementById("coordinates");
const saveButton = document.getElementById("save");
const message = document.getElementById("message");
const count = document.getElementById("count");
const typeSelect = document.getElementById("type");
const widthField = document.getElementById("widthField");
const measurement = document.getElementById("measurement");
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photoPreview");
const previewImage = document.getElementById("previewImage");

function setMessage(text, ok = false) {
  message.textContent = text;
  message.style.color = ok ? "#3e7a48" : "#a33a2b";
}

function updateCategoryUI() {
  const isWidth = typeSelect.value === "Trail width";
  widthField.style.display = isWidth ? "block" : "none";
  if (!isWidth) measurement.value = "";
}
typeSelect.addEventListener("change", updateCategoryUI);
updateCategoryUI();

function initMap(lat = 69.65, lon = 18.95) {
  map = L.map("map").setView([lat, lon], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
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
  const maxSize = 1600;
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

  const marker = L.marker([o.latitude, o.longitude]).addTo(map);
  const date = new Date(o.created_at).toLocaleString();

  const photo = o.photo_url
    ? `<img class="popup-photo" src="${escapeAttr(o.photo_url)}" alt="Observation photo">`
    : "";

  const measurementText =
    o.observation_type === "Trail width" && o.measurement
      ? `<b>Width:</b> ${escapeHtml(o.measurement)} m<br>`
      : "";

  marker.bindPopup(`
    <strong>${escapeHtml(o.group_name)}</strong><br>
    ${escapeHtml(o.observation_type)}<br>
    ${measurementText}
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
  const measurementValue =
    observation_type === "Trail width" ? measurement.value.trim() : "";

  if (!note && !measurementValue && !selectedPhoto) {
    setMessage("Please add a measurement, note, or photo.");
    return;
  }

  if (observation_type === "Trail width" && !measurementValue) {
    setMessage("Please enter the trail width in metres.");
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = selectedPhoto ? "Saving photo…" : "Saving…";

  const row = {
    group_name,
    observation_type,
    note,
    measurement: measurementValue,
    latitude: currentPosition.latitude,
    longitude: currentPosition.longitude,
    gps_accuracy: currentPosition.accuracy
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
