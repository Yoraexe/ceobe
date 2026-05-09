---
name: flutter
description: Expert skill for building high-performance cross-platform mobile apps using Flutter and Dart.
---
# FLUTTER EXPERT SKILL

## 1. Core Philosophy
Flutter is about high-fidelity, natively compiled applications for mobile, web, and desktop from a single codebase. Focus on widget composition, reactive UI, and clean separation between business logic and presentation. Prioritize 60/120 FPS performance and avoid widget tree bloat.

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ **Never use `setState()` for complex, global app state.** It leads to spaghetti code and massive rebuilds. Use a dedicated state management solution (Riverpod, BLoC).
- ❌ **Never perform heavy computations on the UI thread.** Use `Isolate.run()` or `compute()` functions for JSON parsing or heavy math.
- ❌ **Never hardcode strings or dimensions.** Use localization (l10n) via `flutter_localizations` and a consistent theme/spacing system (e.g. `Theme.of(context)`).
- ❌ **Never ignore platform-specific UI guidelines.** Use `Adaptive` widgets where appropriate (e.g., `Switch.adaptive`) to respect iOS vs Android UX.
- ❌ **Never nest heavily deeply.** Break down massive `build` methods into smaller `StatelessWidget` classes. Do NOT use functions returning widgets (`Widget _buildHeader()`), as they don't get optimization benefits from the framework.

## 3. Practical Patterns & Tech Stack

### 3.1 State Management (Riverpod / BLoC)
Default to **Riverpod** for most apps, or **BLoC** for large-scale enterprise apps.
```dart
// Riverpod Example
final counterProvider = StateProvider<int>((ref) => 0);

class CounterWidget extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(counterProvider);
    return Text('$count');
  }
}
```

### 3.2 Clean Architecture (Feature-first)
Structure the project by feature, not by layer:
```
lib/
├── features/
│   ├── auth/
│   │   ├── data/ (Repositories, Models, Data Sources)
│   │   ├── domain/ (Entities, Use Cases)
│   │   └── presentation/ (Widgets, State/Providers)
│   └── profile/
└── core/ (Routing, Network Client, Theme, Constants)
```

### 3.3 Routing & Navigation
Use **GoRouter** for declarative routing, especially if web support is needed.
```dart
final router = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomeScreen(),
    ),
  ],
);
```

### 3.4 Networking
Use **Dio** combined with **Retrofit** for robust API clients, interceptors, and typed responses.

## 4. UI/UX Standards
- Use **Material 3** by default (`useMaterial3: true` in `ThemeData`).
- Ensure all interactive elements have a minimum hit target of 48x48 dp.
- Always support both **Light** and **Dark** modes dynamically.
- Use `SafeArea` to prevent notches and status bars from overlapping UI.

## 5. Automation & Commands
When operating autonomously, use these standard commands:
- **Create Project:** `flutter create --org com.example project_name`
- **Run App:** `flutter run -d chrome` (for fast web testing) or `flutter run -d emulator`
- **Build APK:** `flutter build apk --release`
- **Build iOS:** `flutter build ios --release`
- **Code Generation:** `dart run build_runner build --delete-conflicting-outputs` (for Freezed, Retrofit, Riverpod)
- **Clean:** `flutter clean && flutter pub get`
