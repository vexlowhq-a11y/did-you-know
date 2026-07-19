/*
  Generador de páginas de ARTÍCULO — usado por admin/server.js
  ===============================================================
  Esta es la versión en Node de la parte de "artículos" de
  generate_pages.py: arma categoria/{categoria}/{slug}.html a partir
  de un objeto artículo (título, dek, fecha, cuerpo en texto simple).

  Las páginas de categoría y de tema (los "hubs") las sigue generando
  admin/generate_pages.py (botón "Regenerar categorías y temas" del
  panel) — eso cambia poco y ese script ya está probado. Esto de acá
  es lo que se ejecuta cada vez que guardás un artículo desde el panel,
  así no hace falta correr Python para publicar una noticia.

  Formato del texto del cuerpo (campo "body" del artículo):
    - Párrafos separados por una línea en blanco.
    - "## Texto" al principio de una línea = subtítulo (h2).
    - Líneas seguidas que empiezan con "- " = lista.
    - Una línea que diga exactamente "[publicidad]" = espacio publicitario.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const CATEGORIA_DIR = path.join(ROOT, 'categoria');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const INDEX_HTML_FILE = path.join(ROOT, 'index.html');

// Categories are admin-editable (data/categories.json), not hardcoded — read
// fresh each time rather than cached at module load, since the panel can
// add/rename/delete them without restarting the server.
function loadCategories() {
  try {
    return JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}
function saveCategories(list) {
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(list, null, 2) + '\n', 'utf8');
}
function categoryBySlug(slug) {
  return loadCategories().find(function (c) { return c.slug === slug; }) || null;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

function formatDateEn(iso) {
  var parts = iso.split('-');
  var y = parts[0], m = parts[1], d = parts[2];
  return MONTHS_EN[parseInt(m, 10) - 1] + ' ' + String(parseInt(d, 10)) + ', ' + y;
}

function loadTopicGroups() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'topics.json'), 'utf8'));
  } catch (e) {
    return {};
  }
}

function topicLabelFor(catSlug, topicSlug) {
  if (!topicSlug) return null;
  var groups = loadTopicGroups()[catSlug] || [];
  for (var g = 0; g < groups.length; g++) {
    var items = groups[g][1];
    for (var i = 0; i < items.length; i++) {
      if (items[i][0] === topicSlug) return items[i][1];
    }
  }
  return null;
}

function topicSlugify(label) {
  return String(label)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 40);
}

/* Crea un tema nuevo en data/topics.json para una categoría, dentro de un
   grupo "🆕 Nuevos" (se crea si no existe). No genera HTML acá — para eso
   está el botón "Regenerar categorías y temas" del panel, que corre
   generate_pages.py y arma la tarjeta + la página del tema. */
function addTopic(categorySlug, label, groupName) {
  var cat = categoryBySlug(categorySlug);
  if (!cat) throw new Error('Categoría desconocida: ' + categorySlug);

  var slug = topicSlugify(label);
  if (!slug) throw new Error('El nombre del tema no generó un slug válido');

  var topicsPath = path.join(DATA_DIR, 'topics.json');
  var allGroups = loadTopicGroups();
  var groups = allGroups[categorySlug] || [];

  for (var g = 0; g < groups.length; g++) {
    var items = groups[g][1];
    for (var i = 0; i < items.length; i++) {
      if (items[i][0] === slug) throw new Error('Ya existe un tema con ese nombre en esta categoría');
    }
  }

  var targetName = groupName || '🆕 Nuevos';
  var targetGroup = null;
  for (var g2 = 0; g2 < groups.length; g2++) {
    if (groups[g2][0] === targetName) { targetGroup = groups[g2]; break; }
  }
  if (!targetGroup) {
    targetGroup = [targetName, []];
    groups.push(targetGroup);
  }
  targetGroup[1].push([slug, label]);

  allGroups[categorySlug] = groups;
  fs.writeFileSync(topicsPath, JSON.stringify(allGroups, null, 2) + '\n', 'utf8');
  return { slug: slug, label: label, group: targetName };
}

/* Nombres de los grupos/secciones ya existentes para una categoría, en el
   orden en que aparecen en la página (ej. "⭐ Populares", "Nintendo", ...). */
function listGroupNames(categorySlug) {
  var groups = loadTopicGroups()[categorySlug] || [];
  return groups.map(function (g) { return g[0]; });
}

function findTopic(groups, slug) {
  for (var g = 0; g < groups.length; g++) {
    var items = groups[g][1];
    for (var i = 0; i < items.length; i++) {
      if (items[i][0] === slug) return { groupIndex: g, itemIndex: i };
    }
  }
  return null;
}

function renameTopic(categorySlug, slug, newLabel) {
  if (!categoryBySlug(categorySlug)) throw new Error('Categoría desconocida: ' + categorySlug);
  if (!newLabel || !newLabel.trim()) throw new Error('El nuevo nombre no puede estar vacío');

  var topicsPath = path.join(DATA_DIR, 'topics.json');
  var allGroups = loadTopicGroups();
  var groups = allGroups[categorySlug] || [];
  var found = findTopic(groups, slug);
  if (!found) throw new Error('No se encontró ese tema en esta categoría');

  groups[found.groupIndex][1][found.itemIndex][1] = newLabel.trim();
  allGroups[categorySlug] = groups;
  fs.writeFileSync(topicsPath, JSON.stringify(allGroups, null, 2) + '\n', 'utf8');
  return { slug: slug, label: newLabel.trim() };
}

/* Saca un tema de data/topics.json y borra su página HTML si existe.
   No toca los artículos que lo tengan asignado — eso se valida antes,
   desde server.js, para no dejar links rotos sin avisar. */
function deleteTopic(categorySlug, slug) {
  var cat = categoryBySlug(categorySlug);
  if (!cat) throw new Error('Categoría desconocida: ' + categorySlug);

  var topicsPath = path.join(DATA_DIR, 'topics.json');
  var allGroups = loadTopicGroups();
  var groups = allGroups[categorySlug] || [];
  var found = findTopic(groups, slug);
  if (!found) throw new Error('No se encontró ese tema en esta categoría');

  groups[found.groupIndex][1].splice(found.itemIndex, 1);
  if (groups[found.groupIndex][1].length === 0) {
    groups.splice(found.groupIndex, 1);
  }
  allGroups[categorySlug] = groups;
  fs.writeFileSync(topicsPath, JSON.stringify(allGroups, null, 2) + '\n', 'utf8');

  var topicPage = path.join(CATEGORIA_DIR, cat.slug, slug + '.html');
  if (fs.existsSync(topicPage)) fs.unlinkSync(topicPage);

  return { slug: slug };
}

/* =====================================================================
   SUBTEMAS — un nivel más adentro de un tema (ej. "Brasil" dentro de
   "History of the World Champions" dentro de Sports). Mismo patrón que
   los temas de arriba, pero sin grupos (el tema ya cumple ese rol) y
   con clave compuesta "categoria/temaSlug" en vez de solo la categoría.
   ===================================================================== */

const SUBTOPICS_FILE = path.join(DATA_DIR, 'subtopics.json');

function loadSubtopics() {
  try {
    return JSON.parse(fs.readFileSync(SUBTOPICS_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}
function saveSubtopics(data) {
  fs.writeFileSync(SUBTOPICS_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
function subtopicKey(categorySlug, topicSlug) { return categorySlug + '/' + topicSlug; }

function subtopicLabelFor(catSlug, topicSlug, subtopicSlug) {
  if (!subtopicSlug) return null;
  var items = loadSubtopics()[subtopicKey(catSlug, topicSlug)] || [];
  for (var i = 0; i < items.length; i++) {
    if (items[i][0] === subtopicSlug) return items[i][1];
  }
  return null;
}

function addSubtopic(categorySlug, topicSlug, label) {
  if (!categoryBySlug(categorySlug)) throw new Error('Categoría desconocida: ' + categorySlug);
  if (!topicLabelFor(categorySlug, topicSlug)) throw new Error('No se encontró ese tema en esta categoría');

  var slug = topicSlugify(label);
  if (!slug) throw new Error('El nombre del subtema no generó un slug válido');

  var key = subtopicKey(categorySlug, topicSlug);
  var all = loadSubtopics();
  var items = all[key] || [];
  if (items.some(function (it) { return it[0] === slug; })) {
    throw new Error('Ya existe un subtema con ese nombre en este tema');
  }

  items.push([slug, label]);
  all[key] = items;
  saveSubtopics(all);
  return { slug: slug, label: label };
}

function renameSubtopic(categorySlug, topicSlug, slug, newLabel) {
  if (!newLabel || !newLabel.trim()) throw new Error('El nuevo nombre no puede estar vacío');
  var key = subtopicKey(categorySlug, topicSlug);
  var all = loadSubtopics();
  var items = all[key] || [];
  var found = items.find(function (it) { return it[0] === slug; });
  if (!found) throw new Error('No se encontró ese subtema');
  found[1] = newLabel.trim();
  all[key] = items;
  saveSubtopics(all);
  return { slug: slug, label: newLabel.trim() };
}

/* Saca un subtema de data/subtopics.json y borra su página HTML si existe.
   No toca los artículos que lo tengan asignado — eso se valida antes,
   desde server.js. */
function deleteSubtopic(categorySlug, topicSlug, slug) {
  var cat = categoryBySlug(categorySlug);
  if (!cat) throw new Error('Categoría desconocida: ' + categorySlug);

  var key = subtopicKey(categorySlug, topicSlug);
  var all = loadSubtopics();
  var items = all[key] || [];
  var idx = items.findIndex(function (it) { return it[0] === slug; });
  if (idx === -1) throw new Error('No se encontró ese subtema');
  items.splice(idx, 1);
  if (items.length === 0) delete all[key];
  else all[key] = items;
  saveSubtopics(all);

  var subtopicPage = path.join(CATEGORIA_DIR, cat.slug, topicSlug + '-' + slug + '.html');
  if (fs.existsSync(subtopicPage)) fs.unlinkSync(subtopicPage);

  return { slug: slug };
}

/* =====================================================================
   CATEGORÍAS — a diferencia de los temas, las categorías también viven
   como HTML a mano en index.html (nav lateral, chips de "Latest Posts"
   y dos columnas del footer), porque generate_pages.py/loadSidebarFooter
   de acá arriba copian ese bloque literal a cada página generada. Estas
   funciones edita ese HTML con cirugía de texto en vez de reconstruirlo
   entero, así los temas curados a mano de las categorías existentes
   (los sub-links de cada .cat-item) no se pierden.
   ===================================================================== */

// Posición del primer carácter de la línea que contiene "pos" (para no
// cortar la indentación de una etiqueta a la mitad al insertar/borrar).
function startOfLineContaining(html, pos) {
  var nl = html.lastIndexOf('\n', pos - 1);
  return nl === -1 ? 0 : nl + 1;
}

function findCategoryNavEnd(html) {
  var start = html.indexOf('id="categoryNav"');
  if (start === -1) throw new Error('No se encontró el nav de categorías en index.html');
  var close = html.indexOf('</nav>', start);
  if (close === -1) throw new Error('No se encontró el cierre del nav de categorías en index.html');
  return close + '</nav>'.length;
}

// Devuelve {start, end} del bloque <div class="cat-item">...</div> completo
// (contando divs anidados) que tenga data-cat="{slug}", o null si no existe.
function findCatItemBlock(html, slug) {
  var anchor = html.indexOf('data-cat="' + slug + '"');
  if (anchor === -1) return null;
  var blockStart = html.lastIndexOf('<div class="cat-item">', anchor);
  if (blockStart === -1) return null;
  var i = blockStart + 4; // después de "<div"
  var depth = 1;
  while (depth > 0) {
    var nextOpen = html.indexOf('<div', i);
    var nextClose = html.indexOf('</div>', i);
    if (nextClose === -1) throw new Error('HTML de index.html mal formado cerca de data-cat="' + slug + '"');
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      i = nextClose + 6;
    }
  }
  return { start: blockStart, end: i };
}

function catItemHtml(cat) {
  return '      <div class="cat-item">\n' +
    '        <div class="cat-row">\n' +
    '          <a class="cat-link" href="categoria/' + cat.slug + '/index.html" data-cat="' + cat.slug + '"><span class="ic">' + cat.icon + '</span>' + escapeHtml(cat.label) + '</a>\n' +
    '        </div>\n' +
    '      </div>\n';
}

function readIndexHtml() { return fs.readFileSync(INDEX_HTML_FILE, 'utf8'); }
function writeIndexHtml(html) { fs.writeFileSync(INDEX_HTML_FILE, html, 'utf8'); }

// Agrega el .cat-item (nav lateral, sin subtemas — esos son solo texto
// decorativo en las categorías existentes, todos apuntan al mismo href),
// el filter-chip de "Latest Posts" y el link en la columna "More
// categories" del footer.
function insertCategoryIntoIndexHtml(cat) {
  var html = readIndexHtml();

  var navEnd = findCategoryNavEnd(html);
  var navCloseLine = startOfLineContaining(html, navEnd - '</nav>'.length);
  html = html.slice(0, navCloseLine) + '\n' + catItemHtml(cat) + html.slice(navCloseLine);

  var chipHtml = '        <button type="button" class="filter-chip" data-filter="' + cat.slug + '">' + cat.icon + ' ' + escapeHtml(cat.label) + '</button>\n';
  var filterRowClose = html.indexOf('</div>', html.indexOf('id="filterRow"'));
  var filterRowCloseLine = startOfLineContaining(html, filterRowClose);
  html = html.slice(0, filterRowCloseLine) + chipHtml + html.slice(filterRowCloseLine);

  var footerLinkHtml = '          <a href="categoria/' + cat.slug + '/index.html">' + escapeHtml(cat.label) + '</a>\n';
  var moreCatHeading = html.indexOf('<h4>More categories</h4>');
  if (moreCatHeading === -1) throw new Error('No se encontró la columna "More categories" del footer en index.html');
  var moreCatClose = html.indexOf('</div>', moreCatHeading);
  var moreCatCloseLine = startOfLineContaining(html, moreCatClose);
  html = html.slice(0, moreCatCloseLine) + footerLinkHtml + html.slice(moreCatCloseLine);

  writeIndexHtml(html);
}

// Cambia ícono/nombre en el .cat-item, el filter-chip y el link del
// footer de una categoría existente — el slug no cambia nunca (evita
// tener que migrar la carpeta categoria/{slug}/ y los artículos ya
// publicados bajo esa categoría).
function updateCategoryInIndexHtml(slug, cat) {
  var html = readIndexHtml();

  var block = findCatItemBlock(html, slug);
  if (block) {
    var before = html.slice(0, block.start);
    var blockHtml = html.slice(block.start, block.end);
    var after = html.slice(block.end);
    blockHtml = blockHtml.replace(
      new RegExp('(<a class="cat-link" href="categoria/' + slug + '/index\\.html" data-cat="' + slug + '"><span class="ic">)[^<]*(</span>)[^<]*(</a>)'),
      '$1' + cat.icon + '$2' + escapeHtml(cat.label) + '$3'
    );
    html = before + blockHtml + after;
  }

  var navEnd = findCategoryNavEnd(html);
  var afterNav = html.slice(navEnd);
  afterNav = afterNav.replace(
    new RegExp('(data-filter="' + slug + '">)[^<]*(</button>)'),
    '$1' + cat.icon + ' ' + escapeHtml(cat.label) + '$2'
  );
  afterNav = afterNav.replace(
    new RegExp('(href="categoria/' + slug + '/index\\.html">)[^<]*(</a>)'),
    '$1' + escapeHtml(cat.label) + '$2'
  );
  html = html.slice(0, navEnd) + afterNav;

  writeIndexHtml(html);
}

function removeCategoryFromIndexHtml(slug) {
  var html = readIndexHtml();

  var block = findCatItemBlock(html, slug);
  if (block) {
    var lineStart = startOfLineContaining(html, block.start);
    // Se lleva puesta también la línea en blanco que separa cat-items,
    // si la hay (todo cat-item salvo el primero tiene una antes).
    var removeFrom = lineStart;
    if (html[lineStart - 2] === '\n') removeFrom = lineStart - 1;
    var removeTo = block.end;
    if (html[removeTo] === '\n') removeTo++;
    html = html.slice(0, removeFrom) + html.slice(removeTo);
  }

  var navEnd = findCategoryNavEnd(html);
  var afterNav = html.slice(navEnd);
  afterNav = afterNav.replace(new RegExp('[ \\t]*<button type="button" class="filter-chip" data-filter="' + slug + '">[^<]*</button>\\n?'), '');
  afterNav = afterNav.replace(new RegExp('[ \\t]*<a href="categoria/' + slug + '/index\\.html">[^<]*</a>\\n?'), '');
  html = html.slice(0, navEnd) + afterNav;

  writeIndexHtml(html);
}

function addCategory(label, icon) {
  if (!label || !label.trim()) throw new Error('El nombre de la categoría no puede estar vacío');
  var slug = slugify(label);
  if (!slug) throw new Error('El nombre no generó un slug válido');
  if (categoryBySlug(slug)) throw new Error('Ya existe una categoría con ese nombre');
  if (slug === 'index') throw new Error('Ese nombre de categoría no está permitido');

  var cat = { slug: slug, label: label.trim(), icon: (icon || '📰').trim() };
  var list = loadCategories();
  list.push(cat);
  saveCategories(list);
  insertCategoryIntoIndexHtml(cat);
  return cat;
}

function updateCategory(slug, changes) {
  var list = loadCategories();
  var existing = list.find(function (c) { return c.slug === slug; });
  if (!existing) throw new Error('No se encontró esa categoría');

  if (changes.label && changes.label.trim()) existing.label = changes.label.trim();
  if (changes.icon && changes.icon.trim()) existing.icon = changes.icon.trim();
  saveCategories(list);
  updateCategoryInIndexHtml(slug, existing);
  return existing;
}

function deleteCategory(slug) {
  var list = loadCategories();
  var existing = list.find(function (c) { return c.slug === slug; });
  if (!existing) throw new Error('No se encontró esa categoría');

  var remaining = list.filter(function (c) { return c.slug !== slug; });
  saveCategories(remaining);
  removeCategoryFromIndexHtml(slug);

  var catDir = path.join(CATEGORIA_DIR, slug);
  if (fs.existsSync(catDir)) fs.rmSync(catDir, { recursive: true, force: true });

  return { slug: slug };
}

function loadSidebarFooter() {
  var indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  var sidebarStart = indexHtml.indexOf('<div class="mobile-topbar">');
  var sidebarEnd = indexHtml.indexOf('</aside>') + '</aside>'.length;
  var sidebarBlockRoot = indexHtml.slice(sidebarStart, sidebarEnd);
  var footerStart = indexHtml.indexOf('    <footer class="site-footer">');
  var footerEnd = indexHtml.indexOf('</footer>', footerStart) + '</footer>'.length;
  var footerBlockRoot = indexHtml.slice(footerStart, footerEnd);
  return { sidebar: localize(sidebarBlockRoot), footer: localize(footerBlockRoot) };
}

// Debe coincidir con STATIC_PAGES en generate_pages.py (los nombres reales
// de archivo son en inglés, aunque el resto del panel esté en español).
var STATIC_PAGE_SLUGS = ['about-didyouknow', 'editorial-policy', 'contact', 'advertise', 'privacy', 'terms', 'cookies'];

function localize(html) {
  html = html.split('href="index.html"').join('href="../../index.html"');
  html = html.split('src="img/').join('src="../../img/');
  html = html.split("url('img/").join("url('../../img/");
  loadCategories().forEach(function (cat) {
    html = html.split('href="categoria/' + cat.slug + '/index.html"')
      .join('href="../../categoria/' + cat.slug + '/index.html"');
  });
  STATIC_PAGE_SLUGS.forEach(function (slug) {
    html = html.split('href="' + slug + '.html"')
      .join('href="../../' + slug + '.html"');
  });
  return html;
}

/* ---- parseo del cuerpo en texto simple -> bloques ---- */
function parseBody(text) {
  var blocks = [];
  var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  var paragraphBuf = [];
  function flushParagraph() {
    if (paragraphBuf.length) {
      blocks.push({ type: 'p', text: paragraphBuf.join(' ').trim() });
      paragraphBuf = [];
    }
  }
  var i = 0;
  while (i < lines.length) {
    var line = lines[i].trim();
    if (line === '') { flushParagraph(); i++; continue; }
    if (/^##\s+/.test(line)) { flushParagraph(); blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '') }); i++; continue; }
    if (/^\[publicidad\]$/i.test(line)) { flushParagraph(); blocks.push({ type: 'ad' }); i++; continue; }
    var imgMatch = /^!\[(.*?)\]\((\S+)\)$/.exec(line);
    if (imgMatch) { flushParagraph(); blocks.push({ type: 'img', alt: imgMatch[1], src: imgMatch[2] }); i++; continue; }
    if (/^-\s+/.test(line)) {
      flushParagraph();
      var items = [];
      while (i < lines.length && /^-\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^-\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items: items });
      continue;
    }
    paragraphBuf.push(line);
    i++;
  }
  flushParagraph();
  return blocks;
}

var AD_SLOT_HTML = '      <div class="ad-slot" style="margin: 30px 0;">Advertisement · in-article</div>\n';

/* "**texto**" -> <strong>texto</strong>, dentro de párrafos, subtítulos,
   ítems de lista y pies de foto (nunca dentro del atributo alt). */
function applyInline(text) {
  return String(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function renderBodyHtml(bodyText) {
  var blocks = parseBody(bodyText);
  var html = '';
  blocks.forEach(function (b) {
    if (b.type === 'p') html += '      <p>' + applyInline(b.text) + '</p>\n';
    else if (b.type === 'h2') html += '      <h2>' + applyInline(b.text) + '</h2>\n';
    else if (b.type === 'ul') {
      html += '      <ul>\n';
      b.items.forEach(function (it) { html += '        <li>' + applyInline(it) + '</li>\n'; });
      html += '      </ul>\n';
    } else if (b.type === 'ad') {
      html += AD_SLOT_HTML;
    } else if (b.type === 'img') {
      var altEsc = (b.alt || '').replace(/"/g, '&quot;');
      html += '      <figure class="article-inline-image"><img src="../../' + b.src + '" alt="' + altEsc + '" loading="lazy">';
      if (b.alt) html += '<figcaption>' + applyInline(b.alt) + '</figcaption>';
      html += '</figure>\n';
    }
  });
  return html;
}

var ARTICLE_PAGE_TEMPLATE = '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'<title>{title} — Did You Know?</title>\n' +
'<meta name="description" content="{dek}">\n' +
'<link rel="stylesheet" href="../../css/style.css">\n' +
'<link rel="icon" type="image/svg+xml" href="../../img/favicon.svg">\n' +
'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4351939555314649" crossorigin="anonymous"></script>\n' +
'</head>\n' +
'<body data-category="{catSlug}">\n' +
'\n' +
'{sidebar}\n' +
'\n' +
'  <main>\n' +
'\n' +
'    <nav class="breadcrumb">\n' +
'      <a href="../../index.html">Home</a><span class="sep">/</span><a href="index.html">{catLabel}</a>{topicCrumb}<span class="sep">/</span><span class="current">{titleShort}</span>\n' +
'    </nav>\n' +
'\n' +
'    <article class="article-page">\n' +
'      <span class="chip">{catIcon} {catLabel}</span>\n' +
'      <h1>{title}</h1>\n' +
'      <p class="dek">{dek}</p>\n' +
'      <div class="article-meta">\n' +
'        <span>Did You Know? Staff</span><span class="dot">·</span><span>{dateLabel}</span><span class="dot">·</span><span>{readTime}</span>\n' +
'      </div>\n' +
'\n' +
'{bannerHtml}\n' +
'      <div class="article-body">\n' +
'{bodyHtml}      </div>\n' +
'\n' +
'      <div class="article-share">\n' +
'        <span>Share</span>\n' +
'        <a href="#" data-share="x" aria-label="Share on X">X</a>\n' +
'        <a href="#" data-share="whatsapp" aria-label="Share on WhatsApp">W</a>\n' +
'        <a href="#" data-share="facebook" aria-label="Share on Facebook">F</a>\n' +
'        <a href="#" data-share="copy" aria-label="Copy link">🔗</a>\n' +
'      </div>\n' +
'\n' +
'      <div class="article-continue">\n' +
'        <p>Want more news about <strong>{topicLabel}</strong>?</p>\n' +
'        <a class="see-all" href="{topicHref}">See full coverage →</a>\n' +
'      </div>\n' +
'    </article>\n' +
'\n' +
'{footer}\n' +
'\n' +
'  </main>\n' +
'</div>\n' +
'\n' +
'<script src="../../data/articulos.js"></script>\n' +
'<script src="../../js/script.js"></script>\n' +
'</body>\n' +
'</html>\n';

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, function (m, key) {
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : m;
  });
}

function articleFilePath(article) {
  var cat = categoryBySlug(article.category);
  if (!cat) return null;
  return path.join(CATEGORIA_DIR, cat.slug, article.slug + '.html');
}

function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function youtubeEmbedUrl(url) {
  if (!url) return null;
  var m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? 'https://www.youtube.com/embed/' + m[1] : null;
}

/* Primero prueba si es un link de YouTube (arma la URL de embed canónica).
   Si no, y el link ya es una URL http(s) válida, se usa directo como src
   del iframe — así funcionan links de embed de Vimeo, JWPlayer, etc. */
function videoEmbedUrl(url) {
  if (!url) return null;
  var yt = youtubeEmbedUrl(url);
  if (yt) return yt;
  var trimmed = String(url).trim();
  return /^https?:\/\//.test(trimmed) ? trimmed : null;
}

/* El banner de la nota: video > imagen destacada > ícono de la
   categoría sobre fondo de color, en ese orden de prioridad. */
function bannerHtmlFor(article, cat) {
  var embedUrl = videoEmbedUrl(article.videoUrl);
  if (embedUrl) {
    return '      <div class="article-banner video-wrap">\n' +
      '        <iframe src="' + embedUrl + '" title="' + article.title.replace(/"/g, '&quot;') + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>\n' +
      '      </div>\n';
  }
  if (article.image) {
    return '      <div class="article-banner media ' + cat.slug + '" style="background-image:url(\'../../' + article.image + '\');background-size:cover;background-position:center;"></div>\n';
  }
  return '      <div class="article-banner media ' + cat.slug + '">' + cat.icon + '</div>\n';
}

function generateArticleFile(article) {
  var cat = categoryBySlug(article.category);
  if (!cat) throw new Error('Categoría desconocida: ' + article.category);
  var blocks = loadSidebarFooter();

  var topicSlug = article.topic || '';
  var topicLabel = topicSlug ? topicLabelFor(cat.slug, topicSlug) : null;
  var topicCrumb = '';
  var topicHref = 'index.html';
  if (topicSlug && topicLabel) {
    topicCrumb = '<span class="sep">/</span><a href="' + topicSlug + '.html">' + topicLabel + '</a>';
    topicHref = topicSlug + '.html';
  } else if (!topicLabel) {
    topicLabel = cat.label;
  }

  // Subtema (un nivel más adentro de un tema, ej. "Brasil" dentro de
  // "History of the World Champions") — si está asignado, se agrega
  // como cuarto nivel del breadcrumb y pasa a ser el destino de
  // "Ver toda la cobertura".
  var subtopicSlug = article.subtopic || '';
  var subtopicLabel = (topicSlug && subtopicSlug) ? subtopicLabelFor(cat.slug, topicSlug, subtopicSlug) : null;
  if (topicSlug && subtopicSlug && subtopicLabel) {
    topicCrumb += '<span class="sep">/</span><a href="' + topicSlug + '-' + subtopicSlug + '.html">' + subtopicLabel + '</a>';
    topicLabel = subtopicLabel;
    topicHref = topicSlug + '-' + subtopicSlug + '.html';
  }

  var title = article.title;
  var titleShort = title.length <= 40 ? title : title.slice(0, 37) + '...';

  var html = fill(ARTICLE_PAGE_TEMPLATE, {
    title: title,
    titleShort: titleShort,
    dek: article.dek || '',
    catSlug: cat.slug,
    catLabel: cat.label,
    catIcon: cat.icon,
    dateLabel: formatDateEn(article.date),
    readTime: article.readTime || '',
    bannerHtml: bannerHtmlFor(article, cat),
    bodyHtml: renderBodyHtml(article.body),
    topicCrumb: topicCrumb,
    topicLabel: topicLabel,
    topicHref: topicHref,
    sidebar: blocks.sidebar,
    footer: blocks.footer
  });

  var outPath = articleFilePath(article);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
  return outPath;
}

function deleteArticleFile(article) {
  var filePath = articleFilePath(article);
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

module.exports = {
  loadCategories: loadCategories,
  categoryBySlug: categoryBySlug,
  addCategory: addCategory,
  updateCategory: updateCategory,
  deleteCategory: deleteCategory,
  loadTopicGroups: loadTopicGroups,
  topicLabelFor: topicLabelFor,
  addTopic: addTopic,
  listGroupNames: listGroupNames,
  renameTopic: renameTopic,
  deleteTopic: deleteTopic,
  loadSubtopics: loadSubtopics,
  subtopicLabelFor: subtopicLabelFor,
  addSubtopic: addSubtopic,
  renameSubtopic: renameSubtopic,
  deleteSubtopic: deleteSubtopic,
  slugify: slugify,
  generateArticleFile: generateArticleFile,
  deleteArticleFile: deleteArticleFile
};
