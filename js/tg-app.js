(function () {
'use strict';
var core = window.DpoTgCore;
var data = JSON.parse(document.getElementById('tg-data').textContent);
var tg = window.Telegram && window.Telegram.WebApp;
var inTelegram = !!(tg && tg.initData);
var BRAND_BG = '#FBF9F5';
var ACCENT = '#1658DA';
var SVG_NS = 'http://www.w3.org/2000/svg';
var app = document.getElementById('app');
var bar = document.querySelector('.bar');
var barBack = document.querySelector('.bar-back');
var mainWrap = document.querySelector('.main-btn');
var mainButton = mainWrap.querySelector('button');
var byId = {};
data.programs.forEach(function (p) {
byId[p.id] = p;
});
var unsafe = (inTelegram && tg.initDataUnsafe) || {};
var rawStart = inTelegram ? unsafe.start_param : new URLSearchParams(window.location.search).get('startapp');
var start = core.parseStartParam(rawStart, Object.keys(byId));
var tgUser = unsafe.user || null;
var state = {
stack: [],
sphere: 'all',
query: '',
listScroll: 0,
programId: null,
campaign: start.campaign,
submitted: null,
nameFromTelegram: !!(tgUser && tgUser.first_name),
form: {
firstName: (tgUser && tgUser.first_name) || '',
lastName: (tgUser && tgUser.last_name) || '',
phone: '',
email: '',
position: '',
company: '',
consent: false,
},
};
var mainAction = null;
var firstShow = true;
function h(tag, attrs, children) {
var el = document.createElement(tag);
if (attrs) {
Object.keys(attrs).forEach(function (k) {
var v = attrs[k];
if (v == null || v === false) return;
if (k === 'class') el.className = v;
else if (k === 'text') el.textContent = v;
else el.setAttribute(k, v === true ? '' : String(v));
});
}
(children || []).forEach(function (c) {
if (c == null || c === false || c === '') return;
el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
});
return el;
}
function picture(src) {
return src ? h('img', { src: src, alt: '', loading: 'lazy', decoding: 'async' }) : null;
}
function searchIcon() {
var svg = document.createElementNS(SVG_NS, 'svg');
[['width', '16'], ['height', '16'], ['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'], ['aria-hidden', 'true']].forEach(function (a) {
svg.setAttribute(a[0], a[1]);
});
var circle = document.createElementNS(SVG_NS, 'circle');
circle.setAttribute('cx', '11');
circle.setAttribute('cy', '11');
circle.setAttribute('r', '7');
var handle = document.createElementNS(SVG_NS, 'path');
handle.setAttribute('d', 'm20 20-3.5-3.5');
svg.appendChild(circle);
svg.appendChild(handle);
return svg;
}
function setMain(label, action) {
mainAction = label ? action : null;
if (inTelegram) {
if (label) tg.MainButton.setParams({ text: label, color: ACCENT, text_color: '#FFFFFF', is_active: true, is_visible: true });
else tg.MainButton.hide();
return;
}
mainWrap.hidden = !label;
document.body.classList.toggle('has-main', !!label);
mainButton.textContent = label || '';
}
function runMain() {
if (mainAction) mainAction();
}
function setBack(visible) {
if (inTelegram) {
if (visible) tg.BackButton.show();
else tg.BackButton.hide();
return;
}
barBack.hidden = !visible;
}
function openExternal(url) {
if (!url) return;
if (inTelegram) tg.openLink(url);
else window.open(url, '_blank', 'noopener');
}
function haptic(type) {
if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred(type);
}
function current() {
return state.stack[state.stack.length - 1];
}
function go(name) {
if (current() === 'list') state.listScroll = window.scrollY;
state.stack.push(name);
show(name, 'forward');
}
function back() {
if (state.stack.length < 2) return;
state.stack.pop();
show(current(), 'back');
}
function reset(name) {
state.stack = [name];
show(name, 'forward');
}
function show(name, direction) {
if (name !== 'list' && !byId[state.programId]) {
state.stack = ['list'];
name = 'list';
}
var screen = SCREENS[name](direction);
screen.classList.add('screen', 'in');
if (direction === 'back') screen.classList.add('back');
app.textContent = '';
app.appendChild(screen);
window.scrollTo(0, name === 'list' && direction === 'back' ? state.listScroll : 0);
setBack(state.stack.length > 1);
if (firstShow) {
firstShow = false;
} else {
var heading = screen.querySelector('h1');
if (heading) {
heading.setAttribute('tabindex', '-1');
heading.focus({ preventScroll: true });
}
}
}
function programCard(p, index) {
var price = core.formatPrice(p.price);
var card = h('button', { class: 'card', type: 'button', 'data-id': p.id }, [
h('span', { class: 'cover' }, [
picture(p.thumb),
h('span', { class: 'tags' }, [p.badge && h('span', { class: 'tag', text: p.badge }), p.format && h('span', { class: 'tag', text: p.format })]),
]),
h('span', { class: 'card-body' }, [
h('span', { class: 'card-title', text: p.title }),
h('span', { class: 'meta' }, [
price ? h('span', { class: 'price' }, [price, p.oldPrice ? h('s', { text: core.formatPrice(p.oldPrice) }) : null]) : h('span'),
p.startLabel ? h('span', { text: p.startLabel }) : null,
]),
]),
]);
card.style.setProperty('--i', String(Math.min(index, 7)));
return card;
}
function listScreen(direction) {
var cards = h('div', { class: 'cards' });
var chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Сферы' });
var search = h('input', { type: 'search', placeholder: 'Название или тема', 'aria-label': 'Поиск программ', enterkeyhint: 'search' });
search.value = state.query;
[{ id: 'all', title: 'Все', count: data.programs.length }].concat(data.spheres).forEach(function (s) {
chips.appendChild(
h('button', { class: 'chip', type: 'button', 'data-sphere': s.id, 'aria-pressed': String(state.sphere === s.id) }, [
s.title,
h('small', { text: String(s.count) }),
])
);
});
function fill(cascade) {
var items = core.filterPrograms(data.programs, state.sphere, state.query);
cards.classList.toggle('cascade', cascade);
cards.textContent = '';
if (!items.length) {
cards.appendChild(h('p', { class: 'empty', text: 'Ничего не нашлось. Попробуйте другое слово или сферу.' }));
return;
}
items.forEach(function (p, i) {
cards.appendChild(programCard(p, i));
});
}
chips.addEventListener('click', function (e) {
var chip = e.target.closest('.chip');
if (!chip) return;
state.sphere = chip.getAttribute('data-sphere');
Array.prototype.forEach.call(chips.children, function (c) {
c.setAttribute('aria-pressed', String(c === chip));
});
fill(false);
});
search.addEventListener('input', function () {
state.query = search.value;
fill(false);
});
cards.addEventListener('click', function (e) {
var card = e.target.closest('.card');
if (!card) return;
state.programId = card.getAttribute('data-id');
go('program');
});
fill(direction !== 'back');
setMain(null);
return h('section', { 'aria-label': 'Программы' }, [
h('p', { class: 'eyebrow', text: 'Факультет права НИУ ВШЭ' }),
h('h1', { class: 'h1', text: 'Программы Центра ДПО' }),
h('label', { class: 'search' }, [searchIcon(), search]),
chips,
cards,
]);
}
function section(title, sub, body) {
if (!body) return null;
return h('section', { class: 'block' }, [h('h2', { class: 'h2', text: title }), sub ? h('p', { class: 'sub', text: sub }) : null, body]);
}
function list(cls, items, tag) {
if (!items || !items.length) return null;
return h(tag || 'ul', { class: cls }, items.map(function (x) {
return h('li', { text: x });
}));
}
function outLink(cls, href, children) {
var a = h('a', { class: cls, href: href, target: '_blank', rel: 'noopener noreferrer' }, children);
a.addEventListener('click', function (e) {
if (!inTelegram) return;
e.preventDefault();
tg.openLink(a.href);
});
return a;
}
function hostOf(url) {
try {
return new URL(url).host.replace(/^www\./, '');
} catch (e) {
return '';
}
}
function plural(n, one, few, many) {
var d = n % 10;
var dd = n % 100;
return n + ' ' + (d === 1 && dd !== 11 ? one : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many);
}
function clamped(cls, text, limit) {
var p = h('p', { class: cls + ' clamp', text: text });
if (text.length <= limit) {
p.classList.remove('clamp');
return p;
}
var more = h('button', { class: 'more', type: 'button', 'aria-expanded': 'false', text: 'Читать полностью' });
more.addEventListener('click', function () {
var open = p.classList.toggle('clamp') === false;
more.textContent = open ? 'Свернуть' : 'Читать полностью';
more.setAttribute('aria-expanded', String(open));
});
return h('div', null, [p, more]);
}
function noticeBlock(n) {
if (!n) return null;
return h('div', { class: 'notice', role: 'note' }, [
h('p', { class: 'notice-head' }, [h('span', { class: 'notice-tag', text: 'Важно' }), n.date]),
h('p', { class: 'notice-text', text: n.text }),
n.url ? outLink('notice-link', n.url, ['Смотреть на ' + (hostOf(n.url) || 'сайте') + ' ↗']) : null,
]);
}
function priceBlock(p, price) {
if (!price && !p.priceTerms.length) return null;
return h('div', { class: 'price-box' }, [
price ? h('span', { class: 'price', text: price }) : null,
p.oldPrice ? h('s', { class: 'price-old', text: core.formatPrice(p.oldPrice) }) : null,
list('price-terms', p.priceTerms),
]);
}
function modulesBlock(p) {
if (!p.modules.length) return null;
var sub = plural(p.modules.length, 'модуль', 'модуля', 'модулей') + (p.hours ? ' · ' + p.hours : '');
return section('Программа обучения', sub, h('ol', { class: 'modules' }, p.modules.map(function (m) {
var head = [h('span', { class: 'module-title', text: m.title }), m.hours ? h('span', { class: 'module-hours', text: m.hours }) : null];
if (!m.topics.length) return h('li', null, [h('div', { class: 'module-row' }, head)]);
return h('li', null, [h('details', null, [h('summary', { class: 'module-row' }, head), list('module-topics', m.topics)])]);
})));
}
function filesBlock(p) {
if (!p.files.length) return null;
return section('Документы программы', null, h('ul', { class: 'files' }, p.files.map(function (f) {
return h('li', null, [outLink('file', f.path, [
h('span', { class: 'file-icon', 'aria-hidden': 'true', text: 'PDF' }),
h('span', { class: 'file-name' }, [f.title, h('small', { text: f.size ? 'PDF · ' + f.size : 'PDF' })]),
h('span', { class: 'file-go', 'aria-hidden': 'true', text: '↗' }),
])]);
})));
}
function teachersBlock(p) {
if (!p.teachers.length) return null;
var title = p.teachers.length === 1 ? 'Преподаватель-практик' : 'Преподаватели-практики';
return section(title, null, h('ul', { class: 'teachers' }, p.teachers.map(function (t) {
return h('li', { class: 'teacher' }, [
t.photo ? h('img', { class: 'teacher-photo', src: t.photo, alt: '', loading: 'lazy', decoding: 'async' }) : h('span', { class: 'teacher-photo', 'aria-hidden': 'true' }),
h('div', null, [
t.page
? h('p', { class: 'teacher-name' }, [outLink(null, t.page, [t.name, h('span', { 'aria-hidden': 'true', text: ' ↗' })])])
: h('p', { class: 'teacher-name', text: t.name }),
t.about ? clamped('teacher-about', t.about, 110) : null,
]),
]);
})));
}
function feedbackBlock(p) {
if (!p.feedback.length) return null;
return section('Отзывы выпускников', 'С официальной страницы программы на hse.ru', h('div', { class: 'reviews-scroll', role: 'region', tabindex: '0', 'aria-label': 'Отзывы, листаются вбок' }, [
h('ul', { class: 'reviews' }, p.feedback.map(function (f) {
return h('li', null, [h('blockquote', { text: f.text }), f.author ? h('p', { class: 'review-author', text: f.author }) : null]);
})),
]));
}
function faqBlock(p) {
if (!p.faq.length) return null;
return section('Вопросы и ответы', 'С официальной страницы программы на hse.ru', h('ul', { class: 'faq' }, p.faq.map(function (x) {
return h('li', null, [h('details', null, [h('summary', { text: x.q }), h('p', { class: 'faq-a', text: x.a })])]);
})));
}
function aboutBlock(p) {
var text = p.about || p.tagline;
if (!text) return null;
var body = p.aboutItems ? list('bul', p.aboutItems) : clamped('about', text, 320);
return section('О программе', null, h('div', null, [p.lead ? h('p', { class: 'about-lead', text: p.lead }) : null, body]));
}
function programScreen() {
var p = byId[state.programId];
var price = core.formatPrice(p.price);
var facts = [
['Старт', p.startLabel ? p.startLabel.replace(/^Старт:\s*/, '') : null],
['Формат', p.format],
['Длительность', p.duration],
['Объём', p.hours],
['Язык', p.language],
['График', p.schedule],
['Документ', p.doc],
].filter(function (f) {
return f[1];
});
setMain(price ? 'Подать заявку · ' + price : 'Подать заявку', function () {
go('form');
});
return h('article', { 'aria-label': p.title }, [
h('div', { class: 'hero' }, [picture(p.cover)]),
h('div', { class: 'badges' }, [p.badge && h('span', { class: 'badge', text: p.badge }), p.format && h('span', { class: 'badge', text: p.format })]),
h('h1', { class: 'h1 h1--sm', text: p.title }),
noticeBlock(p.notice),
facts.length
? h('dl', { class: 'facts' }, facts.map(function (f) {
return h('div', { class: 'fact' }, [h('dt', { text: f[0] }), h('dd', { text: f[1] })]);
}))
: null,
priceBlock(p, price),
aboutBlock(p),
section('Кому подойдёт программа', p.audienceIntro, list('pills', p.audience.map(function (x) {
return x.replace(/[,;.]\s*$/, '');
}))),
section('Чему вы научитесь', null, list('bul', p.results)),
section('Преимущества программы', null, list('advantages', p.advantages, 'ol')),
modulesBlock(p),
filesBlock(p),
teachersBlock(p),
feedbackBlock(p),
section('Документы для приёма', null, list('bul', p.admissionDocs)),
faqBlock(p),
]);
}
var FORM_FIELDS = [
['firstName', 'Имя', 'given-name', 'text'],
['lastName', 'Фамилия', 'family-name', 'text'],
['phone', 'Телефон', 'tel', 'tel'],
['email', 'E-mail', 'email', 'email'],
['position', 'Должность, если хотите', 'organization-title', 'text'],
['company', 'Место работы, если хотите', 'organization', 'text'],
];
function formScreen() {
var p = byId[state.programId];
var f = state.form;
var inputs = {};
var errs = {};
function clearError(name) {
errs[name].hidden = true;
errs[name].textContent = '';
inputs[name].removeAttribute('aria-invalid');
}
var rows = FORM_FIELDS.map(function (d) {
var name = d[0];
var input = h('input', {
name: name,
type: d[3],
autocomplete: d[2],
inputmode: d[3] === 'tel' ? 'tel' : null,
maxlength: String(core.LIMITS[name]),
'aria-describedby': 'err-' + name,
});
input.value = f[name];
input.addEventListener('input', function () {
f[name] = input.value;
clearError(name);
});
inputs[name] = input;
errs[name] = h('span', { class: 'field-err', id: 'err-' + name, hidden: true });
var hint = name === 'firstName' && state.nameFromTelegram ? h('span', { class: 'field-hint', text: ' · из профиля Telegram' }) : null;
return h('div', { class: 'field' }, [
h('label', null, [h('span', { class: 'field-label' }, [d[1], hint]), input]),
errs[name],
]);
});
var consent = h('input', { type: 'checkbox', name: 'consent', 'aria-describedby': 'err-consent' });
consent.checked = f.consent;
consent.addEventListener('change', function () {
f.consent = consent.checked;
clearError('consent');
});
inputs.consent = consent;
errs.consent = h('span', { class: 'field-err', id: 'err-consent', hidden: true });
var policy = h('a', { href: '../privacy.html', target: '_blank', rel: 'noopener', text: 'Политикой обработки персональных данных' });
policy.addEventListener('click', function (e) {
if (!inTelegram) return;
e.preventDefault();
tg.openLink(policy.href);
});
function submit() {
Object.keys(errs).forEach(clearError);
var result = core.validateApplication(f);
if (!result.ok) {
result.errors.forEach(function (e) {
errs[e.field].textContent = e.message;
errs[e.field].hidden = false;
inputs[e.field].setAttribute('aria-invalid', 'true');
});
inputs[result.errors[0].field].focus();
haptic('error');
return;
}
state.submitted = result.values;
haptic('success');
go('demo');
}
var form = h('form', { novalidate: true, 'aria-label': 'Данные для заявки' }, rows.concat([
h('label', { class: 'check' }, [
consent,
h('span', null, ['Я подтверждаю, что ознакомился с ', policy, ', и даю согласие на обработку моих персональных данных для рассмотрения заявки.']),
]),
errs.consent,
]));
form.addEventListener('submit', function (e) {
e.preventDefault();
submit();
});
setMain('Отправить заявку', submit);
var price = core.formatPrice(p.price);
return h('section', { 'aria-label': 'Заявка' }, [
h('h1', { class: 'h1 h1--sm', text: 'Заявка' }),
h('div', { class: 'mini' }, [
h('span', { class: 'mini-img' }, [picture(p.thumb)]),
h('span', null, [h('b', { text: p.title }), h('small', { text: [price, p.startLabel].filter(Boolean).join(' · ') })]),
]),
form,
]);
}
function demoScreen() {
var p = byId[state.programId];
var v = state.submitted;
var rows = [['Программа', p.title], ['Имя', v.firstName + ' ' + v.lastName], ['Телефон', v.phone], ['E-mail', v.email]];
if (v.position) rows.push(['Должность', v.position]);
if (v.company) rows.push(['Место работы', v.company]);
if (state.campaign) rows.push(['Метка', state.campaign]);
rows.push(['Откуда', inTelegram ? 'Telegram, мини-приложение' : 'Мини-приложение в браузере']);
setMain(p.pay ? 'Перейти к оплате на hse.ru' : null, function () {
openExternal(p.pay);
});
var again = h('button', { class: 'ghost', type: 'button', text: 'Вернуться к программам' });
again.addEventListener('click', function () {
state.listScroll = 0;
state.form.consent = false;
state.submitted = null;
reset('list');
});
return h('section', { 'aria-label': 'Заявка готова' }, [
h('h1', { class: 'h1 h1--sm', text: 'Заявка готова' }),
h('div', { class: 'plaque', role: 'status' }, [
h('b', { text: 'Демо: заявка не отправлена' }),
h('p', { text: 'В рабочей версии эти данные уйдут в учебный офис Центра ДПО, и менеджер свяжется с вами. Сейчас они не покидают телефон.' }),
]),
h('dl', { class: 'summary' }, rows.map(function (r) {
return h('div', null, [h('dt', { text: r[0] }), h('dd', { text: r[1] })]);
})),
again,
]);
}
var SCREENS = { list: listScreen, program: programScreen, form: formScreen, demo: demoScreen };
if (inTelegram) {
tg.ready();
tg.expand();
if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) tg.setBackgroundColor(BRAND_BG);
if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) tg.setHeaderColor(BRAND_BG);
if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.10') && tg.setBottomBarColor) tg.setBottomBarColor(BRAND_BG);
tg.MainButton.onClick(runMain);
tg.BackButton.onClick(back);
} else {
bar.hidden = false;
mainButton.addEventListener('click', runMain);
barBack.addEventListener('click', back);
}
if (start.programId) {
state.programId = start.programId;
state.stack = ['list'];
go('program');
} else {
reset('list');
}
})();
