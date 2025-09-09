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
 *
 * Usage:
 *   1) Place your GLB at /public/models/test5-chicken.glb (or change MODEL_URL)
 *   2) Place an HDR equirect map at /public/hdr/venice_sunset_1k.hdr (or change ENV_URL)
 *   3) Import and render <AdvancedModelViewerDemo /> in App.tsx
 */

type MVElement = HTMLElement & {
  availableVariants?: string[];
  variantName?: string | null;
  /** model + scene-graph API (runtime) */
  model?: any;
};

const MODEL_URL = '/models/test2.glb';
const ENV_URL = '/hdr/venice_sunset_1k.hdr';

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

  // Read variants and preload material names when loaded
  useEffect(() => {
    const el = mvRef.current;
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
  }, []);

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

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={autoRotate} onChange={(e)=> setAutoRotate(e.target.checked)} />
          Auto-rotate
        </label>

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

      {/* Group toggles 
      <div className="flex flex-wrap items-center gap-4 mb-2">
        {Object.keys(groups).map((k) => (
          <label key={k} className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!groupVisibility[k]} onChange={onChangeGroup(k)} />
            {k}
          </label>
        ))}
      </div>

      */}

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
        ref={mvRef as any}
        src={MODEL_URL}
        alt="Chicken 3D preview"
        style={{ width: '100%', height: 560, background: '#0f172a', borderRadius: 12 }}
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
        หมายเหตุ: รายการ Materials จะดึงจาก GLB ที่โหลด แล้วคุณสามารถซ่อนเป็นราย material ได้ทันที.
        หากต้องการจัดกลุ่มแบบถาวร ให้ปรับ <code>DEFAULT_GROUPS</code> ให้ตรงกับชื่อวัสดุจริงของโมเดลไก่.
      </p>
    </div>
  );
};

export default AdvancedModelViewerDemo;
