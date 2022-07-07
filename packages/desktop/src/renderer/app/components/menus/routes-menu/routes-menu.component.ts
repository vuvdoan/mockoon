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
import { BehaviorSubject, combineLatest, from, Observable, Subscription } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  tap
} from 'rxjs/operators';
import { RouteFolderContextMenu, RoutesContextMenu } from 'src/renderer/app/components/context-menu/context-menus';
import { MainAPI } from 'src/renderer/app/constants/common.constants';
import { FocusableInputs } from 'src/renderer/app/enums/ui.enum';
import { ContextMenuEvent } from 'src/renderer/app/models/context-menu.model';
import { VFolder } from 'src/renderer/app/models/route-folder.model';
import {
  DuplicatedRoutesTypes,
  EnvironmentsStatuses
} from 'src/renderer/app/models/store.model';
import { EnvironmentsService } from 'src/renderer/app/services/environments.service';
import { EventsService } from 'src/renderer/app/services/events.service';
import { UIService } from 'src/renderer/app/services/ui.service';
import { updateEnvironmentroutesFilterAction } from 'src/renderer/app/stores/actions';
import { Store } from 'src/renderer/app/stores/store';
import { Config } from 'src/shared/config';
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
  public activeRoute$: Observable<Route>;
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

  public vFolder$ = new BehaviorSubject<VFolder>({ // NOTE: dont forget to re-initialize when each time environment changes
    name: 'root',
    id: 'root',
    children: [], //empty children when initialized first time
    routes: [] //empty routes when initialized first time
  });

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
    this.activeFolder$ = this.store.selectActiveFolder();
    this.duplicatedRoutes$ = this.store.select('duplicatedRoutes');
    this.environmentsStatus$ = this.store.select('environmentsStatus');
    this.settings$ = this.store.select('settings');
    this.routesFilter$ = this.store.select('routesFilter');

    this.routeList$ = combineLatest([
      this.store.selectActiveEnvironment().pipe(
        filter((activeEnvironment) => !!activeEnvironment),
        distinctUntilChanged(),
        map((activeEnvironment) => activeEnvironment.routes)
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

    // everytime the routelist changes, we do re-calculate the virtual folder structure
    this.routeList$.subscribe(
      (routes) => {
        if (routes && routes.length > 0) {
          this.vFolder$.next(this.handleRouteInVFolder(routes));
        }
      }
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
  public reorderRoutes(event: CdkDragDrop<VFolder, VFolder, string[]>, isGroupedByFolder?: boolean) {
    if (isGroupedByFolder) {
      // TODO: finish me!!!
      // recalculate the index of item to be moved. because the index 
      // starts with 0 with every container
    }
    this.environmentsService.moveMenuItem(
      'routes',
      event.previousIndex,
      event.currentIndex,
      event.previousContainer.data,
      event.container.data
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
   */
  public selectRoute(routeUUID: string) {
    this.environmentsService.setActiveRoute(routeUUID);
  }

  /**
   * Show and position the context menu
   *
   * @param event - click event
   */
  public openContextMenu(routeUUID: string, event: MouseEvent, isFolder: boolean = false) {
    // if right click display context menu
    if (event && event.button === 2) {
      const env = this.store.get('environments');
      const menu: ContextMenuEvent = {
        event,
        items: isFolder? RouteFolderContextMenu(routeUUID, env): RoutesContextMenu(routeUUID, env)
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

  /**
   * Select a folder by UUID and keep the folder status 
   */
  public selectFolder(folderUUID: string) {
    this.environmentsService.setActiveFolder(folderUUID);
  }

  /**
   * When double click, we toggle folder
   */
  public toggleFolder(folderUUID: string) {
    this.environmentsService.toogleFolder(folderUUID);
  }

  /**
   * Get the real status of the environment folder
   */
  public isFolderOpen(vFolderId: string) {
    const foundFolder = this.store.getActiveEnvironment().folders?.find(
      (folder) => folder.uuid === vFolderId);
    if (foundFolder) {
      return foundFolder.isOpen;
    }

    return false;
  }
  
  /**
   * initialize vFolder. 
   * Also do this everytime the environment changes, or the routelist changes
   */
  private initVFolder(): VFolder {
    return {
      name: 'root',
      id: 'root',
      children: [], //empty children when initialized first time
      routes: [] //empty routes when initialized first time
    };
  }


  /** 
   * Can we do it in a more declarative way???
   */
  private handleRouteInVFolder(routesFromStore: Route[]): VFolder {
    const rootFolder = this.initVFolder(); // attention: since everytime a complete routeList is being emitted, we also need to re-initialize the vFolder

    for (const storeRoute of routesFromStore) {
      if (storeRoute.parentFolder) {
        // NOTE: we need to always parse the routeList and update the vFolder, because there are change to one of the route
        const currentFolder: VFolder = this.getFolderByPath(storeRoute.parentFolder, { ...rootFolder }); // do not pass the rootfolder object directly to this function, since it could damage the value of the reference object
        // now we add the route to the current folder, if not already existing
        let vRoute: Route = currentFolder.routes.find((route) => route.uuid === storeRoute.uuid);
        if (!vRoute) {
          currentFolder.routes.push(storeRoute);
        } else {
          vRoute = storeRoute; // route already exists in the current folder. do nothing here
        }

      } else {
        rootFolder.routes.push(storeRoute);
      }
    }

    // after routes are assigned into each folder, we render all empty folders
    this.store.getActiveEnvironment().folders?.forEach((folder) => {
      if (!this.store.getActiveEnvironment().routes.find((route) =>
        route.parentFolder?.includes(folder.uuid))) {
        rootFolder.children.push({
          id: folder.uuid,
          name: folder.folderName,
          children: [],
          routes: []

        });
      }
    });

    return rootFolder;
  }

  /**
   * Get the vFolder from one given path. Starting from the root vFolder
   */
  private getFolderByPath(routeFolderPath: string, currentFolder: VFolder): VFolder {
    const routePaths = routeFolderPath.split('/');
    const environmentFolders: RouteFolder[] = [...this.store.getActiveEnvironment().folders]; // we do this, because the reference might changed during processing
    if (!environmentFolders) {
      console.log('No environment route folder found');

      return currentFolder;
    }

    // we don't use foreach here because I want to be able to break the loop as needed 
    for (const path of routePaths) {
      if (currentFolder.id === path) {
        continue;
      }

      const tmpFolder: VFolder = currentFolder.children.find((folder) => folder.id === path);
      if (tmpFolder) {
        currentFolder = tmpFolder;
        continue;
      } else { // folder doesn't exist in the current directory. add new one folder and continue
        const envFolder: RouteFolder = environmentFolders.find((folder) => folder.uuid === path);
        if (!envFolder) {
          return null;
        }

        const newFolder: VFolder = {
          id: envFolder.uuid,
          name: envFolder.folderName,
          children: [],
          routes: []
        };
        currentFolder.children.push(newFolder);
        currentFolder = newFolder;
      }
    }

    return currentFolder;
  }
}
