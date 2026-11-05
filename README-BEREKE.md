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

## Жергілікті іске қосу

Node.js 22.13+, pnpm 11 және Python 3.10+ керек. Екі терминал ашыңыз.

Бірінші терминал:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
backend/.venv/Scripts/python.exe backend/manage.py migrate
backend/.venv/Scripts/python.exe backend/manage.py createcachetable
backend/.venv/Scripts/python.exe -u backend/manage.py runserver 127.0.0.1:8011 --noreload
```

Екінші терминал:

```powershell
pnpm install
node node_modules/vite/bin/vite.js --config vite.config.ts --host 127.0.0.1 --port 5187 --strictPort
```

Сайт: `http://127.0.0.1:5187/`. Django API: `http://127.0.0.1:8011/`. Басқа порт не хост қолдансаңыз, `DJANGO_API_URL` (frontend сервері) және `DJANGO_CSRF_TRUSTED_ORIGINS` (Django) айнымалыларын нақты мекенжайларға қойыңыз.

Жергілікті режимде email-кодсыз тіркелу және кіру үшін Django серверін іске қосар алдында `$env:DJANGO_LOCAL_EMAIL_AUTH_BYPASS = "1"` орнатыңыз. Бұл қосқыш тек `DJANGO_DEBUG=1` кезінде жұмыс істейді. Қайта қосу үшін айнымалыны алып тастап, Django серверін қайта іске қосыңыз. Құпиясөзді қалпына келтіру сілтемелері жергілікті режимде `backend/data/mail/` ішіне жазылады.

## Django әкімшілік панелі

`http://127.0.0.1:8011/admin/` бетінде топтар, Django әкімшілері және Теңгерім қолданушылары, карталары, транзакциялары, жазылымдары мен бюджеттері көрсетіледі. Бірінші рет кіру үшін терминалда әкімші аккаунтын жасаңыз:

```powershell
backend/.venv/Scripts/python.exe backend/manage.py createsuperuser
```

Команда логин мен құпиясөзді өзіңізден сұрайды. Сайттағы кәдімгі қолданушы аккаунты әкімші аккаунтынан бөлек; оны `createsuperuser` командасы арқылы жасау керек. Әкімші панелі қаржы жазбаларын қарауға және өңдеуге мүмкіндік береді, ал қолданушының құпиясөз хэші панельде көрсетілмейді.

Тіркелу және әр кіру кезінде email-ге алты таңбалы бір реттік код жіберіледі. Код 10 минут жарамды; бес қате әрекеттен кейін жарамсыз болады. Аккаунт тіркелу коды расталғаннан кейін ғана жасалады, ал кіру коды расталғаннан кейін ғана сессия ашылады. Аккаунттың негізгі құпиясөзі хатқа жіберілмейді.

Жергілікті режимде код және құпиясөзді қалпына келтіру хаттары `backend/data/mail/` ішіне `.log` файлдар ретінде жазылады. Кодты ең соңғы файлдан алып, сайттағы терезеге енгізіңіз. Нақты Gmail жіберілімін қосу үшін Gmail аккаунтында екі сатылы растауды қосып, қолданба құпиясөзін жасаңыз. Ыңғайлы іске қосу: `pwsh -File scripts/start-django-gmail.ps1`. Скрипт Gmail адресі мен қолданба құпиясөзін жергілікті терминалда сұрайды, өзіңізге сынақ хатын жібереді және осы жобаның Django серверін SMTP баптауымен қайта іске қосады. Құпиясөз файлға жазылмайды. Қолмен баптау үшін Django серверін іске қосатын PowerShell терезесінде мыналарды орнатыңыз (адресті өз Gmail адресіңізге ауыстырыңыз):

```powershell
$env:DJANGO_EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
$env:DJANGO_EMAIL_HOST = "smtp.gmail.com"
$env:DJANGO_EMAIL_PORT = "587"
$env:DJANGO_EMAIL_USE_TLS = "1"
$env:DJANGO_EMAIL_USER = "you@gmail.com"
$env:DJANGO_FROM_EMAIL = "Теңгерім <you@gmail.com>"
$mailSecret = Read-Host "Gmail қолданба құпиясөзі" -AsSecureString
$env:DJANGO_EMAIL_PASSWORD = [System.Net.NetworkCredential]::new("", $mailSecret).Password
backend/.venv/Scripts/python.exe -u backend/manage.py runserver 127.0.0.1:8011 --noreload
```

Қолданба құпиясөзін репозиторийге қоспаңыз және чатқа жібермеңіз. Бұл айнымалылар тек осы терминал үшін қолданылады. `FRONTEND_URL` басқа болса, оны да орнатыңыз. Gmail бапталмаған кезде хат нақты поштаға бармайды. Телефон нөмірі сақталады, бірақ SMS растау қосылмаған.

Бұрынғы D1 базасынан көшіру қажет болса, Django миграцияларынан кейін бір рет орындаңыз:

```powershell
backend/.venv/Scripts/python.exe backend/manage.py import_d1 backend/data/d1-source-backup.sqlite
```

Бұрынғы қолданушылардың құпиясөз хэштері сақталады және алғашқы сәтті кіргенде Django форматына жаңартылады. `backend/data/` Git-ке қосылмайды, себебі ішінде жеке қаржы деректері бар.

## PostgreSQL-ге ауыстыру

1. PostgreSQL базасын дайындаңыз. Драйвер `backend/requirements.txt` ішінде бар.
2. SQLite қолданылып тұрғанда деректерді шығарыңыз: `backend/.venv/Scripts/python.exe backend/manage.py dumpdata finance --indent 2 -o backend/data/finance-export.json`.
3. `DATABASE_URL=postgresql://user:password@host:5432/database` айнымалысын орнатыңыз.
4. `backend/.venv/Scripts/python.exe backend/manage.py migrate`, `backend/.venv/Scripts/python.exe backend/manage.py createcachetable` және `backend/.venv/Scripts/python.exe backend/manage.py loaddata backend/data/finance-export.json` орындаңыз.
5. Django серверін қайта іске қосыңыз. Frontend кодын өзгерту қажет емес.

Экспортта құпиясөз хэштері мен сессиялар бар, сондықтан оны тек жеке қауіпсіз жерде сақтаңыз. Өндірісте `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS` және `DJANGO_CSRF_TRUSTED_ORIGINS` мәндерін баптаңыз. Django сервері бөлек Python хостингінде жұмыс істеуі керек; Cloudflare Sites Python серверін іске қоспайды.
