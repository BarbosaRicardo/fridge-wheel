// Fridge Wheel — main app logic

const $ = id => document.getElementById(id);

// --- API Key ---
let apiKey = localStorage.getItem('openai_key') || '';
const banner = document.querySelector('.api-banner');
const apiInput = $('api-input');

function refreshBanner() {
  if (apiKey) {
    banner.classList.add('ok');
    banner.querySelector('span').textContent = '✅ OpenAI key saved';
    apiInput.value = '••••••••••••';
  } else {
    banner.classList.remove('ok');
  }
}
refreshBanner();

$('api-save').addEventListener('click', () => {
  const val = apiInput.value.trim();
  if (val && !val.startsWith('•')) {
    apiKey = val;
    localStorage.setItem('openai_key', val);
    refreshBanner();
  }
});

// --- Image upload ---
const dropZone = $('drop-zone');
const fileInput = $('file-input');
const previews = $('previews');
const analyzeBtn = $('analyze-btn');
let images = []; // [{file, dataUrl}]

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('over');
  addFiles([...e.dataTransfer.files]);
});
fileInput.addEventListener('change', () => addFiles([...fileInput.files]));

function addFiles(files) {
  files.filter(f => f.type.startsWith('image/')).forEach(file => {
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
    const wrap = document.createElement('div');
    wrap.className = 'preview-wrap';
    const el = document.createElement('img');
    el.src = img.dataUrl;
    const rm = document.createElement('button');
    rm.className = 'remove-btn';
    rm.textContent = '✕';
    rm.addEventListener('click', () => { images.splice(i, 1); renderPreviews(); });
    wrap.appendChild(el);
    wrap.appendChild(rm);
    previews.appendChild(wrap);
  });
  analyzeBtn.disabled = images.length === 0;
}

// --- OpenAI calls ---
async function callOpenAI(messages, maxTokens = 600) {
  if (!apiKey) { alert('Please enter your OpenAI API key first.'); return null; }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', messages, max_tokens: maxTokens })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || res.statusText); }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

function showLoading(msg) { $('loading').classList.remove('hidden'); $('loading-msg').textContent = msg; }
function hideLoading() { $('loading').classList.add('hidden'); }

// --- Step 1: Analyze ---
let ingredients = '';
let meals = [];

analyzeBtn.addEventListener('click', async () => {
  if (!apiKey) { alert('Enter your OpenAI API key at the top first!'); return; }
  showLoading('Scanning your fridge… 🔍');
  try {
    const content = [
      { type: 'text', text: 'Look at these fridge/cupboard photos. List all identifiable ingredients, one per line, no extras. Just ingredients.' },
      ...images.map(img => ({ type: 'image_url', image_url: { url: img.dataUrl, detail: 'low' } }))
    ];
    ingredients = await callOpenAI([{ role: 'user', content }], 300);

    $('ingredients-out').textContent = '🥕 Found: ' + ingredients.split('\n').join(', ');
    $('ingredients-out').classList.remove('hidden');

    showLoading('Coming up with meal ideas… 🍳');
    const mealResp = await callOpenAI([
      { role: 'user', content: `I have these ingredients:\n${ingredients}\n\nSuggest exactly 8 meals I can make. Return ONLY the meal names, one per line, no numbers or bullets.` }
    ], 200);
    meals = mealResp.split('\n').map(m => m.trim()).filter(Boolean).slice(0, 8);

    wheel.setSegments(meals);
    $('step-wheel').classList.remove('hidden');
    $('step-wheel').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    hideLoading();
  }
});

// --- Step 2: Wheel ---
const canvas = $('wheel-canvas');
const wheel = new SpinWheel(canvas);

$('spin-btn').addEventListener('click', () => {
  if (wheel.spinning) return;
  $('step-recipe').classList.add('hidden');
  wheel.spin(async (winner) => {
    showLoading(`Getting the ${winner} recipe… 🍽️`);
    try {
      const recipe = await callOpenAI([{
        role: 'user',
        content: `Give me a clear, friendly recipe for "${winner}" using ingredients from this list (use others if needed): ${ingredients}\n\nFormat:\n**[Meal name]**\n\nIngredients:\n- ...\n\nSteps:\n1. ...\n\nTip: ...`
      }], 700);
      renderRecipe(recipe);
      $('step-recipe').classList.remove('hidden');
      $('step-recipe').scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      alert('Error fetching recipe: ' + e.message);
    } finally {
      hideLoading();
    }
  });
});

function renderRecipe(text) {
  const out = $('recipe-out');
  // Basic markdown-ish render
  out.innerHTML = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^(Ingredients:|Steps:|Tip:)$/gm, '<h3>$1</h3>')
    .replace(/\n/g, '<br/>');
}

// --- Step 3: Spin Again ---
$('spin-again-btn').addEventListener('click', () => {
  $('step-recipe').classList.add('hidden');
  $('step-wheel').scrollIntoView({ behavior: 'smooth' });
});
