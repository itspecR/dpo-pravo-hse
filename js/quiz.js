/**
 * Опрос «Не можете определиться?» (просьба заказчика 18.08.2026).
 *
 * Один самодостаточный виджет по образцу js/application-form.js: разметка
 * окна и стили живут здесь, потому что лендинг собирается визуальным
 * сборщиком и разложенный по источникам виджет разъехался бы при первой
 * пересборке. Ставится атрибутом на любую кнопку или ссылку:
 *
 *   <a href="Каталог программ.html" data-quiz>Пройти опрос</a>
 *
 * href остаётся фолбэком без JavaScript. Сам опрос никуда ничего не
 * отправляет: три ответа переводятся в параметры адреса каталога
 * (?type=…&format=…&q=…). Тип и формат включают чипы фильтров, отрасль
 * показывается в поисковой строке. Единый перечень областей и привязка
 * программ к ним живут в js/program-branches.js.
 */

(function () {
  'use strict';

  var CATALOG_URL = 'Каталог программ.html';
  var branches = window.DpoProgramBranches && window.DpoProgramBranches.BRANCHES;
  if (!branches || !branches.length) return;

  /** [значение чипа каталога | '' = фильтр не ставим, подпись] */
  var QUESTIONS = [
    {
      group: 'q',
      title: 'Какая отрасль или область права вас интересует?',
      options: [['', 'Пока не определился']].concat(branches.map(function (branch) {
        return [branch.title, branch.title];
      })),
    },
    {
      group: 'type',
      title: 'Какой документ об обучении вам нужен?',
      options: [
        ['', 'Пока не определился'],
        ['ПК', 'Удостоверение о повышении квалификации'],
        ['ПП', 'Диплом о профессиональной переподготовке'],
      ],
    },
    {
      group: 'format',
      title: 'Как вам удобно учиться?',
      options: [
        ['', 'Любой формат'],
        ['online', 'Онлайн'],
        ['offline', 'Очно'],
        ['mixed', 'Смешанный'],
        ['hybrid', 'Гибридный'],
      ],
    },
  ];

  var CSS = [
    '.dpo-quiz-backdrop{position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-start;',
    "font-family:'HSE Sans','IBM Plex Sans',system-ui,sans-serif;",
    'justify-content:center;padding:max(16px,4vh) 16px;overflow-y:auto;',
    'background:rgb(var(--ink) / .55);opacity:0;transition:opacity .22s cubic-bezier(.22,1,.36,1)}',
    '.dpo-quiz-backdrop.is-open{opacity:1}',
    '.dpo-quiz{position:relative;width:100%;max-width:560px;background:var(--bg);color:rgb(var(--ink));',
    'border-radius:18px;box-shadow:0 24px 60px rgb(var(--ink) / .28);padding:clamp(22px,4vw,34px);',
    'transform:translateY(12px) scale(.985);transition:transform .22s cubic-bezier(.22,1,.36,1)}',
    '.dpo-quiz-backdrop.is-open .dpo-quiz{transform:none}',
    '.dpo-quiz h2{font-family:"HSE Slab","Source Serif 4",Georgia,serif;font-size: clamp(1.375rem,3.4vw,1.75rem);',
    'font-weight:600;margin:0 0 6px;padding-right:36px}',
    '.dpo-quiz-sub{font-size:0.9375rem;line-height:1.55;color:#48423A;margin:0 0 18px}',
    '.dpo-quiz fieldset{border:0;padding:0;margin:0 0 18px}',
    '.dpo-quiz legend{font-size:0.9375rem;font-weight:600;margin:0 0 10px;padding:0}',
    '.dpo-quiz-field{margin:0 0 18px}',
    '.dpo-quiz-field label{display:block;font-size:0.9375rem;font-weight:600;margin:0 0 10px}',
    '.dpo-quiz-select{width:100%;min-height:44px;padding:10px 12px;font:inherit;font-size:0.9375rem;',
    'border:1px solid rgb(var(--ink) / .22);border-radius:10px;background:rgb(var(--surface));color:rgb(var(--ink))}',
    '.dpo-quiz-select:focus-visible{outline:2px solid rgb(var(--accent));outline-offset:2px}',
    '.dpo-quiz-opts{display:flex;flex-wrap:wrap;gap:8px}',
    '.dpo-quiz-opt{position:relative}',
    '.dpo-quiz-opt input{position:absolute;inset:0;opacity:0;cursor:pointer}',
    '.dpo-quiz-opt span{display:inline-block;font:inherit;font-size:0.9375rem;line-height:1.3;',
    'padding:9px 16px;border-radius:999px;border:1px solid rgb(var(--ink) / .22);background:rgb(var(--surface));',
    'transition:border-color .15s,background .15s,color .15s}',
    '.dpo-quiz-opt input:checked+span{background:rgb(var(--accent));border-color:rgb(var(--accent));color:rgb(var(--surface))}',
    '.dpo-quiz-opt input:focus-visible+span{outline:2px solid rgb(var(--accent));outline-offset:2px}',
    '.dpo-quiz-submit{display:inline-block;font:inherit;font-size:0.9375rem;font-weight:600;color:rgb(var(--surface));',
    'background:rgb(var(--accent));border:0;border-radius:999px;padding:14px 28px;cursor:pointer;',
    'transition:background .15s}',
    '.dpo-quiz-submit:hover{background:#1145AA}',
    '.dpo-quiz-close{position:absolute;top:18px;right:18px;width:36px;height:36px;border:0;',
    'border-radius:999px;background:var(--bg-tint);color:rgb(var(--ink));font-size:1.125rem;line-height:36px;',
    'cursor:pointer;transition:background .15s}',
    '.dpo-quiz-close:hover{background:rgb(var(--accent) / .1)}',
    '@media (prefers-reduced-motion: reduce){.dpo-quiz-backdrop,.dpo-quiz{transition:none}}',
    // Режим для слабовидящих. Правил не было вовсе, и окно опроса в нём
    // оказывалось прозрачным: глобальное html.vi-mode *{background:
    // transparent !important} гасит и подложку, и саму карточку. Тот же
    // дефект, что у формы заявки и карточки преподавателя (21.08.2026).
    'html.vi-mode .dpo-quiz{background:#fff !important;border:2px solid #000 !important}',
    'html.vi-mode .dpo-quiz-backdrop{background:rgba(0,0,0,.8) !important}',
    'html.vi-mode .dpo-quiz input,html.vi-mode .dpo-quiz label{border-color:#000 !important}',
    'html.vi-mode .dpo-quiz :focus-visible{outline:3px solid #000 !important;outline-offset:2px}',
  ].join('');

  var backdrop = null;
  var opener = null;

  function ensureStyles() {
    if (document.getElementById('dpoQuizCss')) return;
    var style = document.createElement('style');
    style.id = 'dpoQuizCss';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function build() {
    backdrop = document.createElement('div');
    backdrop.className = 'dpo-quiz-backdrop';

    var groupsHtml = QUESTIONS.map(function (q) {
      if (q.group === 'q') {
        var selectOptions = q.options.map(function (opt) {
          return '<option value="' + opt[0] + '">' + opt[1] + '</option>';
        }).join('');
        return '<div class="dpo-quiz-field"><label for="dpoQuizBranch">' + q.title +
          '</label><select class="dpo-quiz-select" id="dpoQuizBranch" name="dpo-quiz-q">' +
          selectOptions + '</select></div>';
      }
      var opts = q.options
        .map(function (opt, i) {
          return (
            '<label class="dpo-quiz-opt"><input type="radio" name="dpo-quiz-' + q.group +
            '" value="' + opt[0] + '"' + (i === 0 ? ' checked' : '') + '><span>' + opt[1] +
            '</span></label>'
          );
        })
        .join('');
      return '<fieldset><legend>' + q.title + '</legend><div class="dpo-quiz-opts">' + opts + '</div></fieldset>';
    }).join('');

    backdrop.innerHTML =
      '<div class="dpo-quiz" role="dialog" aria-modal="true" aria-labelledby="dpoQuizTitle">' +
      '<button type="button" class="dpo-quiz-close" aria-label="Закрыть опрос">×</button>' +
      '<h2 id="dpoQuizTitle">Подберём программу</h2>' +
      '<p class="dpo-quiz-sub">Три вопроса – и вы увидите программы по интересующей области права, документу и формату обучения.</p>' +
      '<form>' + groupsHtml +
      '<button type="submit" class="dpo-quiz-submit">Показать программы</button>' +
      '</form></div>';

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) close();
    });
    backdrop.querySelector('.dpo-quiz-close').addEventListener('click', close);
    backdrop.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var params = new URLSearchParams();
      QUESTIONS.forEach(function (q) {
        var checked = backdrop.querySelector('input[name="dpo-quiz-' + q.group + '"]:checked') ||
          backdrop.querySelector('select[name="dpo-quiz-' + q.group + '"]');
        if (checked && checked.value) params.set(q.group, checked.value);
      });
      var qs = params.toString();
      window.location.href = CATALOG_URL + (qs ? '?' + qs : '');
    });

    document.body.appendChild(backdrop);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key !== 'Tab' || !backdrop) return;
    // Ловушка фокуса: Tab ходит по кругу внутри окна.
    var focusables = backdrop.querySelectorAll('button, input, select');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  var sheetCtl = null;

  function open(fromEl) {
    ensureStyles();
    if (!backdrop) {
      build();
      // Жест «потянуть вниз – закрыть», общий с формой заявки и карточкой
      // преподавателя (js/sheet-gesture.js): похожие окна ведут себя одинаково.
      sheetCtl = window.dpoSheet
        ? window.dpoSheet.attach({
            root: backdrop,
            sheet: backdrop.querySelector('.dpo-quiz'),
            grip: '#dpoQuizTitle',
            onClose: close,
          })
        : null;
    }
    if (sheetCtl) sheetCtl.reset();
    opener = fromEl || null;
    backdrop.style.display = 'flex';
    requestAnimationFrame(function () {
      backdrop.classList.add('is-open');
    });
    document.addEventListener('keydown', onKeydown, true);
    var firstInput = backdrop.querySelector('select, input');
    if (firstInput) firstInput.focus();
  }

  function close() {
    if (!backdrop) return;
    backdrop.classList.remove('is-open');
    backdrop.style.display = 'none';
    document.removeEventListener('keydown', onKeydown, true);
    if (opener && typeof opener.focus === 'function') opener.focus();
    opener = null;
  }

  /* Делегирование на document: рантайм лендинга пересобирает разметку,
     слушатель на самой кнопке не пережил бы перерисовку. */
  document.addEventListener('click', function (e) {
    var trigger = e.target && e.target.closest && e.target.closest('[data-quiz]');
    if (!trigger) return;
    e.preventDefault();
    open(trigger);
  });
})();
