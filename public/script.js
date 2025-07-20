let photoIndex = 0;

// Submit form
document.getElementById("reportForm").onsubmit = async (e) => {
  e.preventDefault();

  const loadingOverlay = document.getElementById('loadingOverlay');
  loadingOverlay.style.display = 'flex';

  const form = document.getElementById("reportForm");
  const data = new FormData(form);

  const address = data.get("address")?.trim().replace(/\s+/g, '_') || "report";
  const date = data.get("date");
  const company = data.get("company");

  const photos1 = [];

  for (let i = 0; i < photoIndex; i++) {
    const file = data.get(`photo${i}`);
    const title = data.get(`photo_title${i}`) || "";

    if (file && file.size > 0) {
      const base64 = await fileToBase64(file);
      photos1.push({ title, image: base64 });
    }
  }

  const jsonData = {
    address,
    date,
    company,
    photos1,  // You can duplicate into photos2/photos3 if needed
    photos2: [],
    photos3: []
  };

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonData)
    });

    loadingOverlay.style.display = 'none';

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${address}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } else {
      alert('יצירת ZIP נכשלה');
    }
  } catch (err) {
    console.error(err);
    alert('שגיאה בשליחה');
    loadingOverlay.style.display = 'none';
  }
};

// Utility to convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // remove "data:image/jpeg;base64,"
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Add photo fields
document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById('photoFieldsContainer');
  const addButton = document.getElementById('addPhotoButton');

  for (let i = 0; i < 9; i++) addPhotoField();

  addButton.addEventListener('click', () => addPhotoField());

  function addPhotoField() {
    const titleLabel = document.createElement('label');
    titleLabel.innerHTML = `כותרת תמונה ${photoIndex + 1}: <input type="text" name="photo_title${photoIndex}"><br>`;

    const photoLabel = document.createElement('label');
    photoLabel.innerHTML = `תמונה ${photoIndex + 1}: <input type="file" name="photo${photoIndex}" accept="image/*"><br><br>`;

    container.appendChild(titleLabel);
    container.appendChild(photoLabel);
    photoIndex++;
  }
});
