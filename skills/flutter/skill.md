---
name: flutter
description: Expert skill for building high-performance cross-platform mobile apps using Flutter and Dart.
---
# FLUTTER EXPERT SKILL

## 1. Core Philosophy
Flutter is about high-fidelity, natively compiled applications for mobile, web, and desktop from a single codebase. Focus on widget composition, reactive UI, and clean separation between business logic and presentation.

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never use `setState()` for complex, global app state. Use a dedicated state management solution.
- ❌ Never perform heavy computations on the UI thread. Use isolates or compute functions.
- ❌ Never hardcode strings or dimensions. Use localization (l10n) and a consistent theme/spacing system.
- ❌ Never ignore platform-specific UI guidelines (Material vs Cupertino). Use `Adaptive` widgets or conditional logic.

## 3. Practical Patterns

### 3.1 State Management (Provider/Riverpod)
Default to **Provider** or **Riverpod** for most apps.
```dart
// Provider Example
class CounterProvider with ChangeNotifier {
  int _count = 0;
  int get count => _count;

  void increment() {
    _count++;
    notifyListeners();
  }
}
```

### 3.2 Clean Architecture (Feature-first)
Structure the project by feature, not by layer:
```
lib/
├── features/
│   ├── auth/
│   │   ├── data/ (Repositories, Data Sources)
│   │   ├── domain/ (Entities, Use Cases)
│   │   └── presentation/ (Widgets, Blocs/Providers)
│   └── profile/
└── core/ (Common utilities, design system)
```

### 3.3 Custom Paint & Performance
Use `CustomPainter` for complex custom UI and always profile with **Flutter DevTools** to ensure 60/120 FPS.

## 4. UI/UX Standards
- Use **Material 3** by default.
- Ensure all interactive elements have a minimum hit target of 48x48 dp.
- Support both Light and Dark modes.
