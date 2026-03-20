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
    return Array.from({ length: this.dish.rating }, (_, index) => index);
  }
}
