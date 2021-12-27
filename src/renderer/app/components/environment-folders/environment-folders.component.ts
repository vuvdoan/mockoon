import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Environment, RouteFolder, RouteFolderDefault } from '@mockoon/commons';
import { merge, Observable, Subject } from 'rxjs';
import {
  distinctUntilKeyChanged,
  filter,
  map,
  takeUntil,
  tap
} from 'rxjs/operators';
import { FocusableInputs } from 'src/renderer/app/enums/ui.enum';
import { EnvironmentsService } from 'src/renderer/app/services/environments.service';
import { Store } from 'src/renderer/app/stores/store';

@Component({
  selector: 'app-environment-folders',
  templateUrl: './environment-folders.component.html',
  styleUrls: ['./environment-folders.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnvironmentFoldersComponent implements OnInit, OnDestroy {
  public activeEnvironment$: Observable<Environment>;
  public activeFolder$: Observable<RouteFolder>;
  public activeRouteFolderForm: FormGroup;
  public focusableInputs = FocusableInputs;
  public Infinity = Infinity;
  private destroy$ = new Subject<void>();

  constructor(
    private store: Store,
    private formBuilder: FormBuilder,
    private environmentsService: EnvironmentsService
  ) { }

  ngOnInit() {
    this.activeEnvironment$ = this.store.selectActiveEnvironment();
    this.activeFolder$ = this.store.selectActiveFolder();

    this.initForms();
    this.initFormValues();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.unsubscribe();
  }

  /**
   * Init forms and subscribe to changes
   */
  private initForms() {
    this.activeRouteFolderForm = this.formBuilder.group({
      documentation: [RouteFolderDefault.documentation],
      folderName: [RouteFolderDefault.folderName]
    });

    // send new activeRouteForm values to the store, one by one
    merge(
      ...Object.keys(this.activeRouteFolderForm.controls).map((controlName) =>
        this.activeRouteFolderForm
          .get(controlName)
          .valueChanges.pipe(map((newValue) => ({ [controlName]: newValue })))
      )
    )
      .pipe(
        tap((newProperty) => {
          this.environmentsService.updateActiveFolder(newProperty);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();

  }

  /**
   * Listen to stores to init form values for folder 
   */
  private initFormValues() {
    this.activeFolder$.pipe(
      filter((activeFolder) => !!activeFolder),
      distinctUntilKeyChanged('uuid'),
      takeUntil(this.destroy$)
    )
      .subscribe((activeFolder) => {
        this.activeRouteFolderForm.patchValue(
          {
            folderName: activeFolder.folderName,
            documentation: activeFolder.documentation
          },
          { emitEvent: false }
        );
      });

  }

}
