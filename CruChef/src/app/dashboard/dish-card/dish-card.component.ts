import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, Input } from '@angular/core';

import { Dish } from '../../models/dish.model';

@Component({
  selector: 'app-dish-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './dish-card.component.html',
  styleUrl: './dish-card.component.css',
})
export class DishCardComponent {
  @Input({ required: true }) dish!: Dish;
  @Input() animationDelay = 0;

  get stars(): number[] {
    const roundedRating = Math.max(0, Math.round(this.dish.rating));
    return Array.from({ length: roundedRating }, (_, index) => index);
  }

  get hasRatings(): boolean {
    return this.dish.ratingCount > 0 && this.dish.rating > 0;
  }
}
