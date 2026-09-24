import { Component, HostListener } from '@angular/core';
import { LightboxService } from '../../services/lightbox.service';

@Component({
  selector: 'app-lightbox',
  standalone: true,
  imports: [],
  templateUrl: './lightbox.component.html',
  styleUrl: './lightbox.component.scss',
})
export class LightboxComponent {
  constructor(public lightbox: LightboxService) {}

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (!this.lightbox.open()) return;
    if (event.key === 'Escape') this.lightbox.close();
    if (event.key === 'ArrowRight') this.lightbox.next();
    if (event.key === 'ArrowLeft') this.lightbox.prev();
  }
}