'use strict';

/**
 * Данные «Топ-5» лежат внутри <script type="text/x-dc"> шаблона лендинга,
 * а сам шаблон – JSON-строкой во внешнем <script type="__bundler/template">.
 * Внешняя оболочка экранирует «</script» только для себя: после JSON.parse
 * загрузчик отдаёт внутреннюю разметку DOMParser как есть, и «</script»
 * из названия программы закрыл бы внутренний script раньше времени, а
 * следующий за ним тег стал бы исполняемым (аудит 13.09.2026, находка 3).
 *
 * Проверяется весь путь: каталог → renderTop5Data → encode → JSON.parse →
 * инертный разбор HTML. Число элементов script не должно вырасти, а
 * значения после исполнения data-блока – совпасть с исходными.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderTop5Data } = require('../../scripts/build-landing');
const { encode } = require('../../scripts/landing-template');

const TEMPLATE = [
  '<!doctype html><html><head>',
  '<script type="text/x-dc" data-dc-script="">',
  '    const data = {',
  '      top5: [',
  '      ]',
  '    };',
  '</script>',
  '</head><body><script src="js/x.js"></script></body></html>',
].join('\n');

const PAYLOAD = 'Право</script><script>window.__dpo_pwned=1</script><!--';

/** Программа, у которой ВСЕ строковые поля, попадающие в top5, враждебны. */
function hostileProgram() {
  return {
    id: PAYLOAD,
    title: PAYLOAD,
    tagline: PAYLOAD,
    about: PAYLOAD,
    duration: PAYLOAD,
    image: PAYLOAD,
    studyFormat: { title: PAYLOAD },
    type: { title: PAYLOAD },
    startDate: '2099-01-01T00:00:00',
  };
}

/**
 * Инертный разбор по правилам HTML для содержимого <script>: тело
 * элемента тянется до первого «</script», за которым идёт пробел, «/» или
 * «>» – кавычки JavaScript для HTML-парсера ничего не значат.
 */
function scriptElements(html) {
  const found = [];
  const open = /<script(?=[\s/>])[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    const bodyStart = m.index + m[0].length;
    const close = /<\/script(?=[\s/>])/gi;
    close.lastIndex = bodyStart;
    const c = close.exec(html);
    const bodyEnd = c ? c.index : html.length;
    found.push({ tag: m[0], body: html.slice(bodyStart, bodyEnd) });
    open.lastIndex = c ? c.index + c[0].length : html.length;
  }
  return found;
}

/** Весь путь лендинга: упаковка во внешний script и обратно. */
function roundTrip(inner) {
  const outer = '<script type="__bundler/template">\n' + encode(inner) + '\n  </script>';
  const start = outer.indexOf('\n') + 1;
  const end = outer.lastIndexOf('\n  </script>');
  return JSON.parse(outer.slice(start, end));
}

/** Исполняет data-блок как JavaScript – так делает рантайм страницы. */
function evalTop5(inner) {
  const open = inner.indexOf('top5: [');
  const close = inner.indexOf('\n      ]', open);
  assert.ok(open >= 0 && close > open, 'структура top5 не найдена');
  return new Function('return {' + inner.slice(open, close + 8) + '}')().top5;
}

test('название с закрывающим script не создаёт новый элемент script', () => {
  const before = scriptElements(roundTrip(TEMPLATE));
  const { template } = renderTop5Data(TEMPLATE, [hostileProgram()]);
  const after = scriptElements(roundTrip(template));

  assert.equal(after.length, before.length, 'после разбора появились лишние элементы script');
  assert.equal(after[0].tag, before[0].tag);
  assert.doesNotMatch(after[0].body, /<\/script/i, 'внутри data-блока остался буквальный </script');
  assert.doesNotMatch(after[0].body, /<!--/, 'внутри data-блока остался буквальный <!--');
  assert.ok(!/__dpo_pwned/.test(after[1].body), 'внедрённый код оказался в исполняемом script');
});

test('враждебные значения всех полей доходят до рантайма как данные', () => {
  const { template } = renderTop5Data(TEMPLATE, [hostileProgram()]);
  const [item] = evalTop5(roundTrip(template));
  for (const key of ['id', 'title', 'tagline', 'duration', 'image', 'kind']) {
    assert.equal(item[key], PAYLOAD, `поле ${key} изменилось при сериализации`);
  }
});

test('обычные значения: кавычки, Unicode, переводы строк и обратный слэш сохраняются', () => {
  const title = 'Практика ФАС: дело \'Роснефть\' и «Газпром» — \\ backslash';
  const tagline = 'Первая строка\nвторая строка\u2028третья';
  const p = { ...hostileProgram(), title, tagline, duration: '1,5 месяца', id: '837181759' };
  const { template } = renderTop5Data(TEMPLATE, [p]);
  const [item] = evalTop5(roundTrip(template));
  // enDash заменяет длинное тире на короткое – это штатное поведение сборки.
  assert.equal(item.title, title.replace(' — ', ' – '));
  assert.equal(item.tagline, 'Первая строка\nвторая строка\u2028третья');
  assert.equal(item.duration, '1,5 месяца');
  assert.equal(item.id, '837181759');
  assert.equal(item.rank, '1');
});

test('вёрстка вокруг data-блока не меняется', () => {
  const { template } = renderTop5Data(TEMPLATE, [hostileProgram()]);
  const head = TEMPLATE.slice(0, TEMPLATE.indexOf('top5: ['));
  const tail = TEMPLATE.slice(TEMPLATE.indexOf('      ]', TEMPLATE.indexOf('top5: [')));
  assert.ok(template.startsWith(head));
  assert.ok(template.endsWith(tail));
});
