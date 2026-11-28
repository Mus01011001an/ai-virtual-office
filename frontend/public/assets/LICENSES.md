# Asset Licenses

| File | Sumber | Lisensi |
|---|---|---|
| hdri/rooftop_day.hdr | https://polyhaven.com/a/rooftop_day | CC0 |
| hdri/shanghai_bund.hdr | https://polyhaven.com/a/shanghai_bund | CC0 |
| textures/wood_floor_worn_* | https://polyhaven.com/a/wood_floor_worn | CC0 |
| textures/concrete_floor_painted_* | https://polyhaven.com/a/concrete_floor_painted | CC0 |
| font Plus Jakarta Sans (npm `@fontsource-variable/plus-jakarta-sans`) | https://github.com/tokotype/PlusJakartaSans | SIL OFL 1.1 (bebas, termasuk komersial) |

Font dibundel lewat npm (tidak ada CC0 yang setara kualitasnya; OFL tetap gratis tanpa atribusi di UI).

Gedung, furnitur, dan karakter dibuat prosedural di kode (tanpa lisensi pihak ketiga).

## Font

- Fredoka (Google Fonts, SIL Open Font License 1.1) — dimuat via `<link>` di `frontend/index.html`, tidak disalin ke repo.

## Office Baru (`/office-new/`)

| Bagian | Sumber | Lisensi |
|---|---|---|
| Kode dasar `frontend/src/office-new/**`, `tools/office-new/premium/*` | https://github.com/GENERAL009/Agent-Office (`premium-app/`, `plugin/premium/`) | MIT — `frontend/src/office-new/LICENSE.agent-office.txt` |
| Kit prop & tekstur `office-new/scene/fallback/*` | dibuat prosedural di kode | milik project (tanpa pihak ketiga) |
| Font Inter, JetBrains Mono | Google Fonts via `<link>` di `frontend/office-new/index.html` | SIL OFL 1.1 |
| Synty POLYGON Office + Mixamo (opsional) | dibeli/diunduh pengguna, dikonversi lokal ke `frontend/public/office-new/models/` (gitignored) | lisensi Synty / Adobe — **tidak pernah di-commit** |
