export interface Rink {
  readonly type: string;
  readonly iceStatus: string;
  readonly lastUpdatedRaw: string;
  readonly isOpen: boolean;
  readonly name: string;
  readonly hyperlink: string;
  readonly address: string;
}
