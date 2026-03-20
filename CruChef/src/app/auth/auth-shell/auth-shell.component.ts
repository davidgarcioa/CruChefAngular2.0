import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './auth-shell.component.html',
  styleUrl: './auth-shell.component.css',
})
export class AuthShellComponent {
  @Input({ required: true }) eyebrow = '';
  @Input({ required: true }) title = '';
  @Input({ required: true }) subtitle = '';
  @Input({ required: true }) alternateText = '';
  @Input({ required: true }) alternateLabel = '';
  @Input({ required: true }) alternateRoute = '';
}
