# Қауіпсіздік тексерісі (14-сабақ)

Тексеру жергілікті Django + сайт нұсқасында жасалды. Автоматты тесттер `backend/finance/tests.py` файлындағы `SecurityScenarioTests`, `ClosedGapsTests` және бұрынғы кластарда, іске қосу: `cd backend && python manage.py test`.

| Сценарий | Күтілетін нәтиже | Қалай тексерілген | Нәтиже |
|---|---|---|---|
| SQL injection мәтіні операция атауында (`x'); DROP TABLE transactions; --`) | Мәтін ретінде сақталады, кесте өзгермейді | `test_sql_injection_text_is_stored_as_plain_text` | Өтті |
| SQL injection кезең параметрінде (`months=3' OR '1'='1`), `id=1 OR 1=1` | 400, ешқандай бөтен жол оқылмайды/өшпейді | сол тест | Өтті |
| HTML/скрипт мәтіні (`<script>alert(1)</script>`) | JSON мәтіні ретінде қайтады, `nosniff` бар; бетте React экранирлейді | `test_html_payload_comes_back_as_json_text_with_nosniff` | Өтті |
| Денеде бөтен `userId` жіберу | Елеусіз қалады, жазба сессиядағы қолданушыға жазылады | `test_foreign_user_id_in_the_body_is_ignored` | Өтті |
| Бөтен операцияны оқу, өзгерту, өшіру | Тізімде жоқ, өзгерту/өшіру 404 | `test_other_users_records_cannot_be_read_changed_or_deleted` | Өтті |
| Кірмей API шақыру | 401 | `test_unauthenticated_requests_are_rejected_everywhere` | Өтті |
| CSRF белгісісіз немесе қате белгімен POST/DELETE | 403; дұрыс белгімен 201 | `test_post_without_csrf_token_is_refused` | Өтті |
| Шыққаннан кейін ескі сессия cookie-сімен әрекет | 401 | `test_logout_ends_the_session_and_the_old_cookie_stops_working` | Өтті |
| Құпиясөзді сақтау және қайтару | Тек хэш; жауаптарда құпиясөз/хэш жоқ | `test_password_is_stored_as_a_hash_and_never_returned` | Өтті |
| Санат операция түріне сай емес (кіріс «Көлік» санатында) | 400 | `test_category_must_match_the_transaction_type` | Өтті |
| Бөтен жазылымға тоқтату сұрауы, бөтен карта күйін өзгерту | 404 | `CancellationRequestTests`, `test_card_status_can_be_changed_by_the_owner_only` | Өтті |
| Әкімші панеліне құпиясөзді іріктеу | 10 әрекеттен кейін 429 | `test_admin_login_attempts_are_limited` | Өтті |
| Кіру, тіркелу, код растау әрекеттерінің шектеуі | Шектен асқанда 429 | `RateLimitWindowTests`, `PhoneAuthenticationTests` | Өтті |
| Сайттың қауіпсіздік тақырыптары | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'` | `next.config.ts`; `curl -I` арқылы `/`, `/about` және қате беттерде тексерілген | Өтті |

## Қорғаныстың құрылымы

- **SQL:** барлық сұраныс Django ORM арқылы параметрленген; шикі SQL қолданылмайды.
- **XSS:** React мәтінді автоматты экранирлейді. Жобада `dangerouslySetInnerHTML` тек қолданылмайтын `components/ui/chart.tsx` файлында, ол қолданушы мәтінін емес, бекітілген түс баптауын шығарады.
- **CSRF:** барлық өзгертуші сұраныс `X-CSRFToken` талап етеді, cookie `Secure` және `SameSite=Lax`.
- **Сессия:** `bereke_session` cookie `HttpOnly`, серверде токеннің хэші ғана сақталады.
- **Карта деректері:** тек банк атауы мен соңғы 4 сан; толық нөмір, CVV, PIN, SMS коды ешқайда сұралмайды.

## Белгілі шектеулер

- Әкімші панелі (`/admin/`) API доменінде ашық, екі факторлы кіру жоқ. Тек құпиясөз және әрекеттерді шектеу бар. Қосымша қорғау үшін панельді жеке мекенжайға шығару не `django-otp` қосу керек.
- Контент-қауіпсіздік саясаты (CSP) тек `frame-ancestors`, `base-uri`, `form-action`, `object-src` бойынша: Next.js ішкі скрипттерін бұзбас үшін скрипт көздері шектелмеген.
- HSTS сайтта қосылмаған; HTTPS-ті Render қамтамасыз етеді.
- Теріс сценарийлер браузермен қолмен толық қайталанбады: негізгісі автотестпен жабылған.
