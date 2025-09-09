import React, { useEffect, useMemo, useRef, useState } from 'react';
import '@google/model-viewer';

/**
 * Advanced demo for <model-viewer> in React
 * - HDRI environment + skybox
 * - ACES tone mapping + exposure control
 * - Auto-rotate toggle + camera controls
 * - Material Variants (KHR_materials_variants) dropdown
 * - "Layer-like" part toggles by material groups (hide/show via alpha)
 * - Material inspector (toggle per material)
 * - Model selector (switch between multiple GLB files)
 *
 * Usage:
 *   1) Put your GLBs under /public/models and edit MODEL_OPTIONS
 *   2) Put an HDR equirect map at /public/hdr/venice_sunset_1k.hdr (or change ENV_URL)
 *   3) Import and render <AdvancedModelViewerDemo /> in App.tsx
 */

type MVElement = HTMLElement & {
  availableVariants?: string[];
  variantName?: string | null;
  /** model + scene-graph API (runtime) */
  model?: any;
};

const BASE = import.meta.env.BASE_URL;

// Preset model options (edit these paths to your files under /public)
const MODEL_OPTIONS = [
  { label: 'Test 1 (default)', src: `${BASE}models/test1.glb` },
  { label: 'Test 2', src: `${BASE}models/test2.glb` },
  { label: 'Test 3', src: `${BASE}models/test3.glb` },
  { label: 'Test 5 Chicken', src: `${BASE}models/test5-chicken.glb` },
  { label: 'Test 6 Car', src: `${BASE}models/test6-car.glb` },
];

const ENV_URL = `${BASE}hdr/venice_sunset_1k.hdr`;

// Configure your part groups by matching material name substrings.
// Adjust these to your model's real material names (inspect via console once loaded).
const DEFAULT_GROUPS: Record<string, string[]> = {
  Body: ['body', 'skin', 'feather', 'coat', 'paint'],
  Details: ['detail', 'metal', 'chrome', 'trim'],
  Eyes: ['eye', 'pupil', 'iris'],
  Beak: ['beak', 'mouth'],
  Comb: ['comb', 'crest'],
};

const AdvancedModelViewerDemo: React.FC = () => {
  const mvRef = useRef<MVElement | null>(null);
  // Track the actual element to (re)bind events when model changes or element remounts
  const [mvEl, setMvEl] = useState<MVElement | null>(null);

  // Model switching
  const [currentModel, setCurrentModel] = useState<string>(MODEL_OPTIONS[0].src);

  const [variants, setVariants] = useState<string[]>([]);
  const [variant, setVariant] = useState('');

  const [exposure, setExposure] = useState(0.95);
  const [autoRotate, setAutoRotate] = useState(true);

  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [groupVisibility, setGroupVisibility] = useState<Record<string, boolean>>({
    Body: true,
    Details: true,
    Eyes: true,
    Beak: true,
    Comb: true,
  });

  // auto-detected materials panel
  const [materials, setMaterials] = useState<string[]>([]);
  const [materialVisibility, setMaterialVisibility] = useState<Record<string, boolean>>({});

  // Cache original baseColorFactor per material so we can restore after hiding
  const originalColor = useRef<Map<string, [number, number, number, number]>>(new Map());

  // When model changes: reset state so inspector/variants are fresh
  useEffect(() => {
    setVariants([]);
    setVariant('');
    setMaterials([]);
    setMaterialVisibility({});
    originalColor.current.clear();
    // Reset group visibility to default
    setGroupVisibility({ Body: true, Details: true, Eyes: true, Beak: true, Comb: true });
  }, [currentModel]);

  // Read variants and preload material names when the element fires 'load'
  useEffect(() => {
    const el = mvEl;
    if (!el) return;

    const onLoad = () => {
      // Variants (KHR_materials_variants)
      const list = Array.isArray(el.availableVariants) ? el.availableVariants : [];
      setVariants(list);
      if (list.length) {
        setVariant((prev) => prev || list[0]);
        el.variantName = el.variantName || list[0];
      }

      // Collect materials + remember original baseColorFactor
      try {
        const mats = el.model?.materials ?? [];
        const names: string[] = [];
        const vis: Record<string, boolean> = {};
        for (const m of mats) {
          if (!m?.name) continue;
          names.push(m.name);
          vis[m.name] = true;
          if (!originalColor.current.has(m.name)) {
            const rgba: [number, number, number, number] = m.pbrMetallicRoughness?.baseColorFactor ?? [1,1,1,1];
            originalColor.current.set(m.name, [...rgba]);
          }
        }
        names.sort((a,b)=>a.localeCompare(b));
        setMaterials(names);
        setMaterialVisibility(vis);
      } catch (e) {
        console.warn('Unable to cache materials', e);
      }
    };

    el.addEventListener('load', onLoad);
    return () => el.removeEventListener('load', onLoad);
  }, [mvEl, currentModel]);

  // Apply variant changes
  useEffect(() => {
    const el = mvRef.current;
    if (el && variant) el.variantName = variant;
  }, [variant]);

  // Helper: set material alpha
  const setMaterialAlpha = (matName: string, alpha: number) => {
    const el = mvRef.current;
    const mats = el?.model?.materials ?? [];
    const m = mats.find((mm: any) => typeof mm?.name === 'string' && mm.name.toLowerCase() === matName.toLowerCase());
    if (!m) return;

    const pmr = m.pbrMetallicRoughness;
    if (!pmr) return;

    const orig = originalColor.current.get(m.name) ?? [1,1,1,1];
    const [r, g, b] = orig;
    pmr.setBaseColorFactor([r, g, b, alpha]);
    m.setAlphaMode(alpha < 1 ? 'BLEND' : 'OPAQUE');
  };

  // Toggle a group by material name patterns
  const updateGroupVisibility = (groupKey: string, visible: boolean) => {
    setGroupVisibility((prev) => ({ ...prev, [groupKey]: visible }));

    const patterns = groups[groupKey] || [];
    const el = mvRef.current;
    if (!el || !patterns.length) return;

    try {
      const mats = el.model?.materials ?? [];
      const alpha = visible ? 1.0 : 0.0;

      for (const m of mats) {
        const name: string = m?.name ?? '';
        const lower = name.toLowerCase();
        if (patterns.some((p) => lower.includes(p.toLowerCase()))) {
          setMaterialAlpha(name, alpha);
          setMaterialVisibility((s)=> ({...s, [name]: visible}));
        }
      }
    } catch (e) {
      console.warn('Failed to toggle group', groupKey, e);
    }
  };

  const toggleSingleMaterial = (name: string, visible: boolean) => {
    setMaterialVisibility((prev)=> ({...prev, [name]: visible}));
    setMaterialAlpha(name, visible ? 1.0 : 0.0);
  };

  const onChangeGroup = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    updateGroupVisibility(k, e.target.checked);
  };

  const cameraOrbit = useMemo(() => '0deg 75deg 2.2m', []);
  const cameraTarget = useMemo(() => '0m 0m 0m', []);

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-3">Interactive Viewer</h2>

      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {/* Model selector */}
        <div className="flex items-center gap-2">
          <span className="opacity-80">Model</span>
          <select
            className="border rounded px-2 py-1"
            value={currentModel}
            onChange={(e)=> setCurrentModel(e.target.value)}
          >
            {MODEL_OPTIONS.map(m => (
              <option key={m.src} value={m.src}>{m.label}</option>
            ))}
          </select>
        </div>

        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={autoRotate} onChange={(e)=> setAutoRotate(e.target.checked)} />
          Auto-rotate
        </label>

        {/* Exposure slider (optional) */}
        {/* <div className="flex items-center gap-2">
          <span className="opacity-80">Exposure</span>
          <input type="range" min={0.2} max={2} step={0.05} value={exposure} onChange={(e)=> setExposure(parseFloat(e.target.value))} />
          <span className="tabular-nums w-10 text-right">{exposure.toFixed(2)}</span>
        </div> */}

        {variants.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="opacity-80">Variant</span>
            <select className="border rounded px-2 py-1" value={variant} onChange={(e)=> setVariant(e.target.value)}>
              {variants.map((v)=> <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Optional: Group toggles */}
      {/* <div className="flex flex-wrap items-center gap-4 mb-2">
        {Object.keys(groups).map((k) => (
          <label key={k} className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!groupVisibility[k]} onChange={onChangeGroup(k)} />
            {k}
          </label>
        ))}
      </div> */}

      {/* Materials inspector */}
      {materials.length > 0 && (
        <details className="mb-3">
          <summary className="cursor-pointer opacity-80">Materials ({materials.length})</summary>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {materials.map((name)=> (
              <label key={name} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!materialVisibility[name]}
                  onChange={(e)=> toggleSingleMaterial(name, e.target.checked)}
                />
                <span className="truncate" title={name}>{name}</span>
              </label>
            ))}
          </div>
        </details>
      )}

      <model-viewer
        key={currentModel} // force re-init on model switch
        ref={(el) => { mvRef.current = el as MVElement | null; setMvEl(el as MVElement | null); }}
        src={currentModel}
        alt="3D preview"
        style={{ minWidth: 1200, width: '100%', height: 560, background: '#0f172a', borderRadius: 12 }}
        camera-controls
        {...(autoRotate ? { 'auto-rotate': '' } : {})}
        environment-image={ENV_URL}
        skybox-image={ENV_URL}
        tone-mapping="aces"
        exposure={String(exposure)}
        shadow-intensity="0.6"
        shadow-softness="0.8"
        camera-orbit={cameraOrbit}
        camera-target={cameraTarget}
        interaction-prompt="auto"
      />

      <p className="mt-3 text-sm opacity-80">
        Tip: Edit <code>MODEL_OPTIONS</code> to point to your GLB files. The inspector resets on each model change.
      </p>
    </div>
  );
};

export default AdvancedModelViewerDemo;
