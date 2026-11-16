import { Component, ElementRef, HostListener, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { GalleryService } from '../../services/gallery.service';
import { LightboxItem, LightboxService } from '../../services/lightbox.service';
import { GalleryCategory } from '../../gallery-category.model';

interface Book {
  index: number;
  slug: string;
  title: string;
  cover: string | null;
  pageCount: number;
  color: string; // cover colour
  fg: string; // readable text / foil colour on that cover
}
interface Quote {
  text: string;
  artist: string;
}

type GroupKind = 'upright' | 'stack' | 'flat' | 'lean';
type PlantKind = 'monstera' | 'snake' | 'succulent' | 'cactus' | 'planter';

interface Template {
  kind: GroupKind;
  size: number; // how many books the group holds
  h: number; // upright height as a fraction of the shelf height
  w: number; // upright width in px
}

interface Group {
  kind: GroupKind;
  books: Book[];
  h: number;
  w: number;
}

interface ShelfRow {
  left: PlantKind[];
  right: PlantKind[];
  groups: Group[];
}

type Slide =
  | { kind: 'image'; item: LightboxItem }
  | { kind: 'quote'; quote: Quote };

interface Turn {
  from: number;
  to: number;
  dir: 'next' | 'prev';
}

const QUOTES: Quote[] = [
  { text: 'Art is never finished, only abandoned.', artist: 'Leonardo da Vinci' },
  { text: 'The purpose of art is to wash the dust of everyday life off our souls.', artist: 'Pablo Picasso' },
  { text: 'Creativity takes courage.', artist: 'Henri Matisse' },
  { text: 'Every artist was first an amateur.', artist: 'Ralph Waldo Emerson' },
  { text: 'I paint my dreams. My paintings are my dreams.', artist: 'Wassily Kandinsky' },
  { text: 'Art must be real before it can be abstract.', artist: 'Carmen Herrera' },
  { text: 'The hand is the visible part of the mind.', artist: 'Bertrand Russell' },
  { text: 'Drawings are a way of thinking with lines.', artist: 'David Hockney' },
];

const PALETTE = [
  { color: '#2f3e55', fg: '#f1ede2' }, // navy
  { color: '#3d5546', fg: '#f1ede2' }, // forest
  { color: '#7a3a43', fg: '#f6ede4' }, // burgundy
  { color: '#2f2f33', fg: '#eee9dc' }, // charcoal
  { color: '#c9b894', fg: '#2b2519' }, // sand
  { color: '#5f6f7d', fg: '#f4f1ea' }, // slate
  { color: '#a35f45', fg: '#fbf1e6' }, // clay
  { color: '#e6e0d1', fg: '#2b2924' }, // linen
  { color: '#6b6e46', fg: '#f4f0e0' }, // olive
];

/*
 * Shelf layouts, following the sketch:
 *  top shelf:    stack of 2 flat books, medium upright, tall upright, one wide flat book
 *  bottom shelf: three upright books, one leaning, a stack of 2 flat books
 */
const TOP_TEMPLATE: Template[] = [
  { kind: 'stack', size: 2, h: 0, w: 0 },
  { kind: 'upright', size: 1, h: 0.78, w: 52 },
  { kind: 'upright', size: 1, h: 1, w: 48 },
  { kind: 'flat', size: 1, h: 0, w: 0 },
];

const BOTTOM_TEMPLATE: Template[] = [
  { kind: 'upright', size: 1, h: 0.64, w: 46 },
  { kind: 'upright', size: 1, h: 1, w: 56 },
  { kind: 'upright', size: 1, h: 0.72, w: 46 },
  { kind: 'lean', size: 1, h: 0.94, w: 48 },
  { kind: 'stack', size: 2, h: 0, w: 0 },
];

const TOP_CAPACITY = 5;
const BOTTOM_CAPACITY = 6;

/** Heights / widths for books that don't fit the sketch layout. */
const EXTRA_H = [0.7, 0.9, 0.8, 0.96, 0.74];
const EXTRA_W = [46, 52, 44, 56, 48];

const TURN_MS = 700;

type BookView = 'shelf' | 'cover' | 'reading';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent implements OnDestroy {
  private readonly gallery = inject(GalleryService);
  private readonly lightbox = inject(LightboxService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private turnTimer: ReturnType<typeof setTimeout> | null = null;

  readonly activeSlug = signal<string | null>(null);
  readonly view = signal<BookView>('shelf');
  readonly currentPage = signal(0);
  readonly turn = signal<Turn | null>(null);
  readonly quote = signal<Quote>(QUOTES[0]);

  readonly categories = this.gallery.categories;
  readonly totalItems = this.gallery.totalItems;

  readonly books = computed<Book[]>(() =>
    this.categories().map((category, i) => ({
      index: i,
      slug: category.slug,
      title: category.name,
      cover: category.items[0] ?? null,
      pageCount: category.items.length,
      ...PALETTE[i % PALETTE.length],
    }))
  );

  /** Two shelves, laid out like the sketch, with plants at the ends. */
  readonly shelves = computed<ShelfRow[]>(() => {
    const all = this.books();
    const split = Math.ceil((all.length * TOP_CAPACITY) / (TOP_CAPACITY + BOTTOM_CAPACITY));
    return [
      { left: ['monstera'], right: ['succulent', 'cactus'], groups: this.buildGroups(all.slice(0, split), TOP_TEMPLATE) },
      { left: ['planter'], right: ['snake'], groups: this.buildGroups(all.slice(split), BOTTOM_TEMPLATE) },
    ];
  });

  readonly activeMeta = computed<Book | undefined>(() => {
    const slug = this.activeSlug();
    return slug ? this.books().find((b) => b.slug === slug) : undefined;
  });

  readonly activeBook = computed<GalleryCategory | undefined>(() => {
    const slug = this.activeSlug();
    if (!slug) return undefined;
    return this.categories().find((category) => category.slug === slug);
  });

  readonly pages = computed<LightboxItem[]>(() => {
    const category = this.activeBook();
    if (!category) return [];
    return category.items.map((src) => this.gallery.toItem(src, category.name));
  });

  /** Every image page, followed by one final quote page. */
  readonly slides = computed<Slide[]>(() => [
    ...this.pages().map((item): Slide => ({ kind: 'image', item })),
    { kind: 'quote', quote: this.quote() },
  ]);

  readonly totalSlides = computed(() => this.slides().length);
  readonly isTurning = computed(() => this.turn() !== null);
  readonly isFirst = computed(() => this.currentPage() === 0);
  readonly isLast = computed(() => this.currentPage() >= this.totalSlides() - 1);

  /** Page lying on the table while a leaf is flipping. */
  readonly baseIndex = computed(() => {
    const t = this.turn();
    if (!t) return this.currentPage();
    return t.dir === 'next' ? t.to : t.from;
  });

  /** Page printed on the flipping leaf (-1 when nothing is flipping). */
  readonly leafIndex = computed(() => {
    const t = this.turn();
    if (!t) return -1;
    return t.dir === 'next' ? t.from : t.to;
  });

  constructor() {
    // keep the active thumbnail visible in the sidebar
    effect(() => {
      this.currentPage();
      this.view();
      if (typeof window !== 'undefined') {
        setTimeout(() => this.scrollThumbIntoView(), 60);
      }
    });
  }

  openBook(slug: string) {
    this.clearTurn();
    this.quote.set(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
    this.activeSlug.set(slug);
    this.currentPage.set(0);
    this.view.set('cover');
    this.scrollTop();
  }

  showBook() {
    this.view.set('reading');
  }

  backToShelf() {
    this.clearTurn();
    this.activeSlug.set(null);
    this.view.set('shelf');
    this.currentPage.set(0);
    this.scrollTop();
  }

  turnPage(direction: 'next' | 'prev') {
    if (this.view() !== 'reading') return;
    const from = this.currentPage();
    this.flip(from, direction === 'next' ? from + 1 : from - 1);
  }

  /** Jump straight to a drawing (used by the sidebar). */
  goToPage(index: number) {
    if (this.isTurning() || index < 0 || index >= this.pages().length) return;

    if (this.view() === 'cover') {
      this.currentPage.set(index);
      this.view.set('reading');
      return;
    }

    const from = this.currentPage();
    if (index !== from) this.flip(from, index);
  }

  private flip(from: number, to: number) {
    if (this.isTurning() || to === from || to < 0 || to >= this.totalSlides()) return;
    this.turn.set({ from, to, dir: to > from ? 'next' : 'prev' });
    this.currentPage.set(to);
    this.turnTimer = setTimeout(() => this.turn.set(null), TURN_MS);
  }

  openPage(index: number) {
    this.lightbox.show(this.pages(), index);
  }

  isVideo(src: string | null): boolean {
    return !!src && /\.(mp4|mov|webm)$/i.test(src);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (this.view() === 'shelf') return;
    if (event.key === 'Escape') {
      this.backToShelf();
    } else if (this.view() === 'reading') {
      if (event.key === 'ArrowRight') this.turnPage('next');
      if (event.key === 'ArrowLeft') this.turnPage('prev');
    }
  }

  ngOnDestroy() {
    this.clearTurn();
  }

  private buildGroups(books: Book[], template: Template[]): Group[] {
    const capacity = template.reduce((sum, t) => sum + t.size, 0);
    const plan = [...template];

    // more books than the sketch has room for: add upright books
    if (books.length > capacity) {
      const at = plan.findIndex((t) => t.kind === 'upright') + 1;
      const extra: Template[] = Array.from({ length: books.length - capacity }, (_, i) => ({
        kind: 'upright',
        size: 1,
        h: EXTRA_H[i % EXTRA_H.length],
        w: EXTRA_W[i % EXTRA_W.length],
      }));
      plan.splice(at, 0, ...extra);
    }

    const groups: Group[] = [];
    let cursor = 0;
    for (const t of plan) {
      if (cursor >= books.length) break;
      const take = books.slice(cursor, cursor + t.size);
      cursor += take.length;
      const kind: GroupKind = t.kind === 'stack' && take.length === 1 ? 'flat' : t.kind;
      groups.push({ kind, books: take, h: t.h, w: t.w });
    }
    return groups;
  }

  private clearTurn() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.turn.set(null);
  }

  private scrollThumbIntoView() {
    const root = this.host.nativeElement;
    const list = root.querySelector<HTMLElement>('.sidebar-list');
    const active = root.querySelector<HTMLElement>('.thumb.active');
    if (!list || !active) return;
    list.scrollTo({
      top: active.offsetTop - (list.clientHeight - active.clientHeight) / 2,
      left: active.offsetLeft - (list.clientWidth - active.clientWidth) / 2,
      behavior: 'smooth',
    });
  }

  private scrollTop() {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
