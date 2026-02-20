// ===== Fridge Wheel — App Logic =====

// --- State ---
let apiKey = localStorage.getItem('fw_api_key') || '';
let images = []; // { file, dataUrl }
let meals = [];
let wheel;

// --- DOM refs ---
const apiBanner  = document.getElementById('api-banner');
const apiInput   = document.getElementById('api-input');
const apiSave    = document.getElementById('api-save');
const dropZone   = document.getElementById('drop-zone');
const fileInput  = document.getElementById('file-input');
const previews   = document.getElementById('previews');
const analyzeBtn = document.getElementById('analyze-btn');
const ingredOut  = document.getElementById('ingredients-out');
const stepWheel  = document.getElementById('step-wheel');
const spinBtn    = document.getElementById('spin-btn');
const stepRecipe = document.getElementById('step-recipe');
const recipeOut  = document.getElementById('recipe-out');
const spinAgain  = document.getElementById('spin-again-btn');
const loading    = document.getElementById('loading');
const loadingMsg = document.getElementById('loading-msg');

// --- Init ---
if (apiKey) {
  apiInput.value = apiKey;
  apiBanner.classList.add('saved');
  apiBanner.querySelector('span').textContent = '✅ API key saved';
}

wheel = new SpinWheel('wheel-canvas', []);

// --- API key ---
apiSave.addEventListener('click', () => {
  const val = apiInput.value.trim();
  if (!val.startsWith('sk-')) { alert('That doesn\'t look like a valid OpenAI key (should start with sk-)'); return; }
  apiKey = val;
  localStorage.setItem('fw_api_key', apiKey);
  apiBanner.classList.add('saved');
  apiBanner.querySelector('span').textContent = '✅ API key saved';
});

// --- File handling ---
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('over');
  addFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => addFiles(fileInput.files));

function addFiles(fileList) {
  Array.from(fileList).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      images.push({ file, dataUrl: e.target.result });
      renderPreviews();
    };
    reader.readAsDataURL(file);
  });
}

function renderPreviews() {
  previews.innerHTML = '';
  images.forEach((img, i) => {
    const el = document.createElement('div');
    el.className = 'preview-item';
    el.innerHTML = `<img src="${img.dataUrl}" alt="photo ${i+1}" /><button class="remove" data-i="${i}">✕</button>`;
    previews.appendChild(el);
  });
  analyzeBtn.disabled = images.length === 0 || !apiKey;
}

previews.addEventListener('click', e => {
  if (e.target.classList.contains('remove')) {
    images.splice(+e.target.dataset.i, 1);
    renderPreviews();
  }
});

// --- OpenAI call ---
async function callOpenAI(messages, maxTokens = 800) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: maxTokens,
      messages
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// --- Step 1: Analyze ---
analyzeBtn.addEventListener('click', async () => {
  if (!apiKey) { alert('Please save your OpenAI API key first.'); return; }
  if (images.length === 0) return;

  showLoading('Scanning your fridge & cupboards...');

  try {
    const imageContent = images.map(img => ({
      type: 'image_url',
      image_url: { url: img.dataUrl, detail: 'low' }
    }));

    const ingredientText = await callOpenAI([{
      role: 'user',
      content: [
        ...imageContent,
        {
          type: 'text',
          text: 'Look at these photos of my fridge and cupboards. List all the food ingredients you can identify. Be concise — just a comma-separated list of ingredients, nothing else.'
        }
      ]
    }], 400);

    ingredOut.innerHTML = `<strong>Ingredients found:</strong> ${ingredientText}`;
    ingredOut.classList.remove('hidden');

    showLoading('Dreaming up meal ideas...');

    const mealText = await callOpenAI([{
      role: 'user',
      content: `I have these ingredients: ${ingredientText}. Give me exactly 8 meal ideas I can make (or mostly make) with these. Reply with ONLY a JSON array of meal name strings, nothing else. Example: ["Pasta Carbonara","Fried Rice"]`
    }], 300);

    let parsed;
    try {
      parsed = JSON.parse(mealText.replace(/```json|```/g, '').trim());
    } catch {
      parsed = mealText.split('\n').map(l => l.replace(/^[-\d."]+\s*/, '').replace(/[",]/g,'').trim()).filter(Boolean).slice(0, 8);
    }
    meals = parsed.slice(0, 8);

    wheel.setItems(meals);
    stepWheel.classList.remove('hidden');
    stepWheel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    alert(`Something went wrong: ${err.message}`);
  } finally {
    hideLoading();
  }
});

// --- Step 2: Spin ---
spinBtn.addEventListener('click', () => {
  if (wheel.spinning) return;
  stepRecipe.classList.add('hidden');
  wheel.spin(async (meal) => {
    showLoading(`Getting the recipe for ${meal}...`);
    try {
      const recipe = await callOpenAI([{
        role: 'user',
        content: `Give me a recipe for "${meal}" using ingredients I likely have on hand. Format your response in markdown with: the meal name as an H3, a short intro, an Ingredients H4 with a bullet list, and a Steps H4 with a numbered list. Keep it concise and practical.`
      }], 600);

      recipeOut.innerHTML = markdownToHtml(recipe);
      stepRecipe.classList.remove('hidden');
      stepRecipe.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      alert(`Couldn't load recipe: ${err.message}`);
    } finally {
      hideLoading();
    }
  });
});

// --- Step 3: Spin again ---
spinAgain.addEventListener('click', () => {
  stepRecipe.classList.add('hidden');
  stepWheel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// --- Markdown → HTML (tiny parser) ---
function markdownToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => {
      const tag = /^\d/.test(m) ? 'ol' : 'ul';
      return `<${tag}>${m}</${tag}>`;
    })
    .replace(/^(?!<[huo]|<li).+$/gm, l => l.trim() ? `<p>${l}</p>` : '')
    .replace(/\n{2,}/g, '\n');
}

// --- Helpers ---
function showLoading(msg = 'Loading...') {
  loadingMsg.textContent = msg;
  loading.classList.remove('hidden');
}
function hideLoading() {
  loading.classList.add('hidden');
}
