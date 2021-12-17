import { CdkDragDrop } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { FormBuilder, FormControl } from '@angular/forms';
import { Environment, Route, RouteFolder } from '@mockoon/commons';
import { combineLatest, from, Observable, Subscription } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  distinctUntilKeyChanged,
  filter,
  map,
  tap
} from 'rxjs/operators';
import { RouteFolderContextMenu, RoutesContextMenu } from 'src/renderer/app/components/context-menu/context-menus';
import { Config } from 'src/renderer/app/config';
import { MainAPI } from 'src/renderer/app/constants/common.constants';
import { FocusableInputs } from 'src/renderer/app/enums/ui.enum';
import { ContextMenuEvent, ContextMenuItem } from 'src/renderer/app/models/context-menu.model';
import { EnvironmentsService } from 'src/renderer/app/services/environments.service';
import { EventsService } from 'src/renderer/app/services/events.service';
import { UIService } from 'src/renderer/app/services/ui.service';
import { updateEnvironmentroutesFilterAction } from 'src/renderer/app/stores/actions';
import {
  DuplicatedRoutesTypes,
  EnvironmentsStatuses,
  Store
} from 'src/renderer/app/stores/store';
import { Settings } from 'src/shared/models/settings.model';

@Component({
  selector: 'app-routes-menu',
  templateUrl: './routes-menu.component.html',
  styleUrls: ['./routes-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoutesMenuComponent implements OnInit, OnDestroy {
  @ViewChild('routesMenu') private routesMenu: ElementRef;
  public settings$: Observable<Settings>;
  public activeEnvironment$: Observable<Environment>;
  public routeList$: Observable<Route[]>;
  public routeFolderList$: Observable<RouteFolder[]>;
  public activeRoute$: Observable<Route>;
  public activeRoute: string;
  public activeFolder$: Observable<RouteFolder>;
  public environmentsStatus$: Observable<EnvironmentsStatuses>;
  public duplicatedRoutes$: Observable<DuplicatedRoutesTypes>;
  public routesFilter$: Observable<string>;
  public routesFilter: FormControl;
  public dragIsDisabled = false;
  public focusableInputs = FocusableInputs;
  public os$: Observable<string>;
  public menuSize = Config.defaultRouteMenuSize;
  private routesFilterSubscription: Subscription;

  constructor(
    private environmentsService: EnvironmentsService,
    private store: Store,
    private eventsService: EventsService,
    private uiService: UIService,
    private formBuilder: FormBuilder
  ) { }

  @HostListener('keydown', ['$event'])
  public escapeFilterInput(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.clearFilter();
    }
  }

  ngOnInit() {
    this.os$ = from(MainAPI.invoke('APP_GET_OS'));
    this.routesFilter = this.formBuilder.control('');
    this.activeEnvironment$ = this.store.selectActiveEnvironment();
    this.activeRoute$ = this.store.selectActiveRoute();
    // basically, this is the same pipe as activeRoute$. only different is the inside operator 
    this.activeFolder$ = this.store.selectActiveFolder();
    this.duplicatedRoutes$ = this.store.select('duplicatedRoutes');
    this.environmentsStatus$ = this.store.select('environmentsStatus');
    this.settings$ = this.store.select('settings');
    this.routesFilter$ = this.store.select('routesFilter');

    //NOTE: should this have the same logic as routelist?
    this.routeFolderList$ = combineLatest([
      this.store.selectActiveEnvironment().pipe(
        filter((activeEnvironment) => !!activeEnvironment),
        distinctUntilChanged(),
        map((activeEnvironment) => activeEnvironment.folders)
      ),
      this.routesFilter$.pipe(
        tap((search) => {
          this.routesFilter.patchValue(search, { emitEvent: false });
        })
      )
    ]).pipe(
      map(([folders, search]) => {
        return folders; // no filtering here. TODO: filter folder or route here
      })
    );


    this.routeList$ = combineLatest([
      this.store.selectActiveEnvironment().pipe(
        filter((activeEnvironment) => !!activeEnvironment),
        distinctUntilChanged(),
        map((activeEnvironment) => {
          let routes = activeEnvironment.routes;
          return routes;
        })
      ),
      this.routesFilter$.pipe(
        tap((search) => {
          this.routesFilter.patchValue(search, { emitEvent: false });
        })
      )
    ]).pipe(
      map(([routes, search]) => {
        this.dragIsDisabled = search.length > 0;

        if (search.charAt(0) === '/') {
          search = search.substring(1);
        }

        return routes.filter(
          (route) =>
            route.endpoint.includes(search) ||
            route.documentation.includes(search)
        );
      })
    );

    this.uiService.scrollRoutesMenu.subscribe((scrollDirection) => {
      this.uiService.scroll(this.routesMenu.nativeElement, scrollDirection);
    });

    this.routesFilterSubscription = this.routesFilter.valueChanges
      .pipe(
        debounceTime(10),
        tap((search) =>
          this.store.update(updateEnvironmentroutesFilterAction(search))
        )
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.routesFilterSubscription.unsubscribe();
  }

  /**
   * Callback called when reordering routes
   *
   * @param event
   */
  public reorderRoutes(event: CdkDragDrop<string[]>) {
    this.environmentsService.moveMenuItem(
      'routes',
      event.previousIndex,
      event.currentIndex
    );
  }

  /**
   * Create a new route in the current environment. Append at the end of the list
   */
  public addRoute() {
    this.environmentsService.addRoute();

    if (this.routesMenu) {
      this.uiService.scrollToBottom(this.routesMenu.nativeElement);
    }
  }


  /**
   * Select a route by UUID, or the first route if no UUID is present
   * @param routeUUID - the selected route ID
   * @param folderUUID - the enclosed folder, where the route belong. 
   *                     If the folderUUID is null, the route  is on the top level
   */
  public selectRoute(routeUUID: string, folderUUID?: string) {
    this.environmentsService.setActiveRoute(routeUUID, folderUUID);
  }

  /**
   * Select a folder by UUID, or the first folder if no UUID is present
   */
  public selectFolder(folderUUID: string) {
    this.environmentsService.toogleFolder(folderUUID);
  }

  /**
   * Show and position the context menu
   *
   * @param event - click event
   */
  public openContextMenu(subjectUUID: string, event: MouseEvent, isFolder: boolean = false) {
    // if right click display context menu
    if (event && event.button === 2) {
      const env = this.store.get('environments');
      const menu: ContextMenuEvent = {
        event,
        items: isFolder ? RouteFolderContextMenu(subjectUUID, env) : RoutesContextMenu(subjectUUID, env)
      };

      this.eventsService.contextMenuEvents.next(menu);
    }
  }

  /**
   * Clear the filter route
   */
  public clearFilter() {
    this.store.update(updateEnvironmentroutesFilterAction(''));
  }
}
