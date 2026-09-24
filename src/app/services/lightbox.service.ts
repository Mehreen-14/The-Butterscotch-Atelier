import { Injectable, signal } from '@angular/core';

export interface LightboxItem {
  src: string;
  title: string;
  category: string;
  type: 'image' | 'video';
}

@Injectable({ providedIn: 'root' })
export class LightboxService {
  private readonly _open = signal(false);
  private readonly _items = signal<LightboxItem[]>([]);
  private readonly _index = signal(0);

  readonly open = this._open.asReadonly();
  readonly items = this._items.asReadonly();
  readonly index = this._index.asReadonly();

  show(items: LightboxItem[], index = 0) {
    this._items.set(items);
    this._index.set(index);
    this._open.set(true);
  }

  close() {
    this._open.set(false);
  }

  next() {
    if (this._items().length === 0) return;
    this._index.update((i) => (i + 1) % this._items().length);
  }

  prev() {
    if (this._items().length === 0) return;
    this._index.update((i) => (i - 1 + this._items().length) % this._items().length);
  }
}