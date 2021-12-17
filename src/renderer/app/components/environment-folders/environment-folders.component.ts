import { CdkDragDrop } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Environment, RouteFolder, RouteFolderDefault } from '@mockoon/commons';
import { combineLatest, from, merge, Observable, Subject } from 'rxjs';
import {
  distinctUntilChanged,
  distinctUntilKeyChanged,
  filter,
  map,
  mergeMap,
  pluck,
  startWith,
  takeUntil,
  tap
} from 'rxjs/operators';
import { TimedBoolean } from 'src/renderer/app/classes/timed-boolean';
import { Config } from 'src/renderer/app/config';
import { INDENT_SIZE, MainAPI } from 'src/renderer/app/constants/common.constants';
import { FocusableInputs } from 'src/renderer/app/enums/ui.enum';
import { EnvironmentsService } from 'src/renderer/app/services/environments.service';
import { UIService } from 'src/renderer/app/services/ui.service';
import {
  EnvironmentsStatuses,
  Store,
  TabsNameType
} from 'src/renderer/app/stores/store';

@Component({
  selector: 'app-environment-folders',
  templateUrl: './environment-folders.component.html',
  styleUrls: ['./environment-folders.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnvironmentFoldersComponent implements OnInit, OnDestroy {
  public activeEnvironment$: Observable<Environment>;
  public activeFolder$: Observable<RouteFolder>;
  public environmentsStatus$: Observable<EnvironmentsStatuses>;
  public activeTab$: Observable<TabsNameType>;
  public activeRouteFolderForm: FormGroup;
  public scrollToBottom = this.uiService.scrollToBottom;
  public focusableInputs = FocusableInputs;
  public Infinity = Infinity;
  private destroy$ = new Subject<void>();

  constructor(
    private uiService: UIService,
    private store: Store,
    private formBuilder: FormBuilder,
    private environmentsService: EnvironmentsService
  ) { }

  ngOnInit() {
    this.activeEnvironment$ = this.store.selectActiveEnvironment();
    this.activeFolder$ = this.store.selectActiveFolder();
    this.environmentsStatus$ = this.store.select('environmentsStatus');
    this.activeTab$ = this.store.select('activeTab');

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
        )
      });

  }

}
