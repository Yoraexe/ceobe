---
name: capacitor-ionic
description: Skill for bridging web apps (Vue/React/Svelte) to native mobile using Capacitor and Ionic.
---
# CAPACITOR & IONIC SKILL

## 1. Core Philosophy
Leverage web technologies (HTML, CSS, JS) to build native-quality mobile apps. Use Capacitor for native API access and Ionic for mobile-optimized UI components.

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never use browser-specific APIs (like `window.alert`) when native equivalents exist.
- ❌ Never ignore the safe-area-insets. Always handle the notch and home indicator.
- ❌ Never perform large DOM manipulations that cause jank. Use native-like transitions.
- ❌ Never bundle large assets in the binary. Use remote assets or optimized local storage.

## 3. Practical Patterns

### 3.1 Accessing Native APIs
Use the `@capacitor/core` and `@capacitor/plugins` for device features.
```javascript
import { Camera, CameraResultType } from '@capacitor/camera';

const takePicture = async () => {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: true,
    resultType: CameraResultType.Uri
  });
};
```

### 3.2 Mobile-Optimized Layouts (Ionic)
When using Ionic, leverage the `IonPage`, `IonContent`, and `IonHeader` structure for proper mobile behavior.

### 3.3 Splash Screen & Icons
Always use `@capacitor/assets` to generate splash screens and icons from a single source image.

## 4. Performance
- Use **Shadow DOM** where possible for component isolation.
- Ensure all images are lazy-loaded and responsive.
- Minimize JS bundle size for fast initial load.
