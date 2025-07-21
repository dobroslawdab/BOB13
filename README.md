# BOB13

Projekt BOB13 z integracją Supabase

## Funkcje

- ✅ Konfiguracja Next.js
- ✅ Integracja z Supabase
- ✅ Gotowe helpery dla autentyfikacji
- ✅ Helpery dla operacji bazodanowych
- ✅ TypeScript support
- ✅ Tailwind CSS

## Konfiguracja

1. Sklonuj repozytorium:
```bash
git clone https://github.com/dobroslawdab/BOB13.git
cd BOB13
```

2. Zainstaluj zależności:
```bash
npm install
```

3. Skonfiguruj zmienne środowiskowe:
- Skopiuj `.env.example` do `.env.local`
- Twoje dane Supabase są już skonfigurowane

4. Uruchom aplikację:
```bash
npm run dev
```

## Supabase Integration

### URL projektu: 
`https://qxjudardrlbxqxlvpdvl.supabase.co`

### Dostępne helpery:

#### Autentyfikacja:
```javascript
import { supabaseHelpers } from './lib/supabase'

// Rejestracja
const { data, error } = await supabaseHelpers.signUp(email, password)

// Logowanie
const { data, error } = await supabaseHelpers.signIn(email, password)

// Wylogowanie
const { error } = await supabaseHelpers.signOut()

// Pobranie aktualnego użytkownika
const user = await supabaseHelpers.getCurrentUser()
```

#### Operacje na bazie danych:
```javascript
// Pobranie danych
const { data } = await supabaseHelpers.fetchData('users', '*', { active: true })

// Dodanie danych
const { data, error } = await supabaseHelpers.insertData('users', { name: 'Jan', email: 'jan@example.com' })

// Aktualizacja danych
const { data, error } = await supabaseHelpers.updateData('users', { name: 'Jan Kowalski' }, { id: 1 })

// Usunięcie danych
const { error } = await supabaseHelpers.deleteData('users', { id: 1 })
```

## Struktura projektu

```
BOB13/
├── lib/
│   └── supabase.js          # Konfiguracja i helpery Supabase
├── types/
│   └── supabase.ts          # TypeScript types (generowane)
├── .env.example             # Przykład konfiguracji
├── .env.local              # Twoja konfiguracja (nie commitowana)
├── package.json
└── README.md
```

## Następne kroki

1. Utwórz tabele w Supabase Dashboard
2. Wygeneruj TypeScript types: `npm run supabase:gen-types`
3. Stwórz swoje komponenty i strony
4. Skonfiguruj RLS (Row Level Security) w Supabase

## Przydatne linki

- [Supabase Dashboard](https://app.supabase.com/project/qxjudardrlbxqxlvpdvl)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
