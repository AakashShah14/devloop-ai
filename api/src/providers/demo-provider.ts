import type {
  GenerationResult,
  PlanResult,
  QualityScores,
  ReviewResult,
} from '../domain.js';
import type { LoopProvider } from './provider.js';

const codeVersions = [
  `import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <form [formGroup]="form" (ngSubmit)="submit()">
      <input formControlName="email" placeholder="Email" />
      <input formControlName="password" type="password" placeholder="Password" />
      <button>Sign in</button>
    </form>
  \`,
})
export class LoginComponent {
  form = new FormGroup({ email: new FormControl(''), password: new FormControl('') });
  submit() { console.log(this.form.value); }
}`,
  `import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label for="email">Email</label>
      <input id="email" formControlName="email" type="email" autocomplete="email" />
      @if (form.controls.email.touched && form.controls.email.invalid) {
        <p role="alert">Enter a valid email address.</p>
      }
      <label for="password">Password</label>
      <input id="password" formControlName="password" type="password" autocomplete="current-password" />
      <button [disabled]="form.invalid || loading()">{{ loading() ? 'Signing in…' : 'Sign in' }}</button>
    </form>
  \`,
})
export class LoginComponent {
  loading = signal(false);
  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });
  submit() { if (this.form.valid) this.loading.set(true); }
}`,
  `import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <form [formGroup]="form" (ngSubmit)="submit()" aria-labelledby="login-title" novalidate>
      <h1 id="login-title">Welcome back</h1>
      <label for="email">Email</label>
      <input id="email" formControlName="email" type="email" autocomplete="email"
        [attr.aria-invalid]="form.controls.email.touched && form.controls.email.invalid" />
      @if (form.controls.email.touched && form.controls.email.invalid) {
        <p id="email-error" role="alert">Enter a valid email address.</p>
      }
      <label for="password">Password</label>
      <input id="password" formControlName="password" type="password" autocomplete="current-password" />
      @if (error()) { <p role="alert">{{ error() }}</p> }
      <button type="submit" [disabled]="form.invalid || loading()">
        {{ loading() ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  \`,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
  });

  submit(): void {
    if (this.form.invalid || this.loading()) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.form.getRawValue()).pipe(finalize(() => this.loading.set(false))).subscribe({
      error: () => this.error.set('We could not sign you in. Check your details and try again.'),
    });
  }
}`,
];

const score = (values: Omit<QualityScores, 'overall'>, overall: number): QualityScores => ({
  ...values,
  overall,
});

const reviews: ReviewResult[] = [
  {
    scores: score(
      { correctness: 62, maintainability: 64, security: 48, accessibility: 35, performance: 76, requirementCoverage: 62 },
      58,
    ),
    findings: [
      'The form has no validation or disabled loading state.',
      'Placeholder-only inputs lack accessible labels.',
      'Credentials are logged instead of sent through an authentication service.',
    ],
  },
  {
    scores: score(
      { correctness: 78, maintainability: 80, security: 68, accessibility: 82, performance: 80, requirementCoverage: 70 },
      76,
    ),
    findings: [
      'The request has no error path, so loading can remain active after failure.',
      'The component should use an authentication abstraction and typed non-nullable controls.',
      'Password validation feedback is not yet announced to assistive technology.',
    ],
  },
  {
    scores: score(
      { correctness: 93, maintainability: 92, security: 88, accessibility: 94, performance: 89, requirementCoverage: 92 },
      91,
    ),
    findings: [
      'All requested states and validation paths are represented.',
      'Authentication is isolated behind a service and errors are user-safe.',
      'A production team should add integration tests against its real identity provider.',
    ],
  },
];

const changes = [
  ['Created a standalone reactive login component.'],
  ['Added validation, labels, autocomplete hints, and a loading state.', 'Blocked invalid submissions.'],
  ['Added typed controls, AuthService integration, safe error handling, and OnPush change detection.'],
];

export class DemoProvider implements LoopProvider {
  readonly name = 'demo' as const;

  constructor(private readonly pause: () => Promise<void> = () => Promise.resolve()) {}

  async plan(_requirement: string): Promise<PlanResult> {
    await this.pause();
    return {
      summary: 'Build a secure, accessible Angular login flow with explicit async states.',
      steps: [
        'Model email and password with a typed reactive form.',
        'Expose validation feedback with accessible labels and live error messaging.',
        'Route authentication through a service and protect duplicate submissions.',
        'Handle loading, success, and safe failure states.',
      ],
    };
  }

  async generate(_requirement: string, _plan: PlanResult): Promise<GenerationResult> {
    await this.pause();
    return { code: codeVersions[0], language: 'typescript', changes: changes[0] };
  }

  async review(
    _requirement: string,
    _plan: PlanResult,
    _code: string,
    iteration: number,
  ): Promise<ReviewResult> {
    await this.pause();
    return reviews[Math.min(iteration - 1, reviews.length - 1)];
  }

  async improve(
    _requirement: string,
    _plan: PlanResult,
    _code: string,
    _review: ReviewResult,
    nextIteration: number,
  ): Promise<GenerationResult> {
    await this.pause();
    const index = Math.min(nextIteration - 1, codeVersions.length - 1);
    return { code: codeVersions[index], language: 'typescript', changes: changes[index] };
  }
}
