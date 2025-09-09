import '@google/model-viewer';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        poster?: string;
        alt?: string;
        'camera-controls'?: boolean | '';
        'auto-rotate'?: boolean | '';
        'ar'?: boolean | '';
        'ar-modes'?: string;
        'ios-src'?: string;
        exposure?: string | number;
        'shadow-intensity'?: string | number;
        'camera-orbit'?: string;
        'camera-target'?: string;
        'field-of-view'?: string;
        'interaction-prompt'?: string;
        'variant-name'?: string; // สำหรับ KHR_materials_variants
      };
    }
  }
}