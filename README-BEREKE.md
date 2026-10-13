# Теңгерім

Жеке қаржы сайтының интерфейсі React/Vinext арқылы, ал тіркелу, профиль және қаржы API-і Django арқылы жұмыс істейді. Бастапқы дерекқор — SQLite. Django модельдері мен миграциялары PostgreSQL-ге көшуге дайын.

## Қайда не сақталады

- `backend/data/db.sqlite3` — қазір қолданылатын жергілікті база: қолданушылар, сессиялар, карталар, операциялар және жазылымдар.
- `backend/data/d1-source-backup.sqlite` — бұрынғы жергілікті D1 базасының сақтық көшірмесі. Оны жоймаңыз.
- `backend/finance/models.py` — Django дерекқор модельдері.
- `backend/finance/models.py` ішіндегі `Budget` — санат бойынша айлық лимиттер; `GET/POST/DELETE /api/budgets` оларды басқарады. Шығындар ағымдағы күнтізбелік айдың операцияларынан есептеледі.
- `backend/finance/migrations/` — Django схемасының миграциялары.
- `backend/finance/management/commands/import_d1.py` — бұрынғы D1 деректерін Django-ға көшіру командасы. Қайта іске қосқанда бұрын импортталған жазбаларды өзгертпейді.
- `app/api/*/route.ts` — браузер сұрауларын Django API-іне бағыттайды.
- `app/page.tsx` — операцияларды қосу, түзету және жою интерфейсі. Түзетулер `PATCH /api/finance` арқылы сақталады; айлық бюджет шығындары бірден қайта есептеледі.
- `components/auth-dialog.tsx` — телефон нөмірімен тіркелу және email не телефон арқылы кіру терезесі.
- `app/reset-password/page.tsx` және `app/verify-email/page.tsx` — құпиясөзді қалпына келтіру және email растау беттері.
- `components/preferences-provider.tsx`, `lib/translations.ts` — қазақ, орыс, ағылшын тілдері және жарық/қараңғы тақырып. Таңдау браузерде сақталады.
- `db/` және `drizzle/` — бұрынғы D1 схемасы мен миграциялары; сайттың қазіргі API-і оларды қолданбайды.

## Жергілікті іске қосу

Node.js 22.13+, pnpm 11 және Python 3.10+ керек. Екі терминал ашыңыз.

Бірінші терминал:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
backend/.venv/Scripts/python.exe backend/manage.py migrate
backend/.venv/Scripts/python.exe -u backend/manage.py runserver 127.0.0.1:8011 --noreload
```

Екінші терминал:

```powershell
pnpm install
node node_modules/vite/bin/vite.js --config vite.config.ts --host 127.0.0.1 --port 5187 --strictPort
```

Сайт: `http://127.0.0.1:5187/`. Django API: `http://127.0.0.1:8011/`. Басқа порт не хост қолдансаңыз, `DJANGO_API_URL` (frontend сервері) және `DJANGO_CSRF_TRUSTED_ORIGINS` (Django) айнымалыларын нақты мекенжайларға қойыңыз.

## Django әкімшілік панелі

`http://127.0.0.1:8011/admin/` бетінде топтар, Django әкімшілері және Теңгерім қолданушылары, карталары, транзакциялары, жазылымдары мен бюджеттері көрсетіледі. Бірінші рет кіру үшін терминалда әкімші аккаунтын жасаңыз:

```powershell
backend/.venv/Scripts/python.exe backend/manage.py createsuperuser
```

Команда логин мен құпиясөзді өзіңізден сұрайды. Сайттағы кәдімгі қолданушы аккаунты әкімші аккаунтынан бөлек; оны `createsuperuser` командасы арқылы жасау керек. Әкімші панелі қаржы жазбаларын қарауға және өңдеуге мүмкіндік береді, ал қолданушының құпиясөз хэші панельде көрсетілмейді.

Жергілікті режимде растау және құпиясөзді қалпына келтіру хаттары `backend/data/mail/` ішіне `.log` файлдар ретінде жазылады. Сілтемені сол файлдан браузерге көшіріп ашыңыз. Нақты email жіберу үшін Django серверіне `DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, `DJANGO_EMAIL_HOST`, `DJANGO_EMAIL_PORT`, `DJANGO_EMAIL_USER`, `DJANGO_EMAIL_PASSWORD`, `DJANGO_EMAIL_USE_TLS`, `DJANGO_FROM_EMAIL` және сайттың ашық мекенжайы болатын `FRONTEND_URL` айнымалыларын орнатыңыз. Бұл баптауларсыз хаттар сыртқа жіберілмейді. Телефон нөмірі сақталады, бірақ SMS растау әзірге қосылмаған.

Бұрынғы D1 базасынан көшіру қажет болса, Django миграцияларынан кейін бір рет орындаңыз:

```powershell
backend/.venv/Scripts/python.exe backend/manage.py import_d1 backend/data/d1-source-backup.sqlite
```

Бұрынғы қолданушылардың құпиясөз хэштері сақталады және алғашқы сәтті кіргенде Django форматына жаңартылады. `backend/data/` Git-ке қосылмайды, себебі ішінде жеке қаржы деректері бар.

## PostgreSQL-ге ауыстыру

1. PostgreSQL базасын дайындаңыз. Драйвер `backend/requirements.txt` ішінде бар.
2. SQLite қолданылып тұрғанда деректерді шығарыңыз: `backend/.venv/Scripts/python.exe backend/manage.py dumpdata finance --indent 2 -o backend/data/finance-export.json`.
3. `DATABASE_URL=postgresql://user:password@host:5432/database` айнымалысын орнатыңыз.
4. `backend/.venv/Scripts/python.exe backend/manage.py migrate` және `backend/.venv/Scripts/python.exe backend/manage.py loaddata backend/data/finance-export.json` орындаңыз.
5. Django серверін қайта іске қосыңыз. Frontend кодын өзгерту қажет емес.

Экспортта құпиясөз хэштері мен сессиялар бар, сондықтан оны тек жеке қауіпсіз жерде сақтаңыз. Өндірісте `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS` және `DJANGO_CSRF_TRUSTED_ORIGINS` мәндерін баптаңыз. Django сервері бөлек Python хостингінде жұмыс істеуі керек; Cloudflare Sites Python серверін іске қоспайды.
