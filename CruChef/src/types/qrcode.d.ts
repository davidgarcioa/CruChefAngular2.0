declare module 'qrcode' {
  export type QRCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

  export interface QRCodeToDataURLOptions {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: QRCodeErrorCorrectionLevel;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions,
  ): Promise<string>;
}
