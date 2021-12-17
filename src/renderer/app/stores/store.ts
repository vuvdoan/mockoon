import { Injectable } from '@angular/core';
import {
  Environment,
  Environments,
  Route,
  RouteResponse
} from '@mockoon/commons';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map, pluck } from 'rxjs/operators';
import { INDENT_SIZE } from 'src/renderer/app/constants/common.constants';
import {
  ActiveEnvironmentsLogUUIDs,
  EnvironmentLog,
  EnvironmentLogs
} from 'src/renderer/app/models/environment-logs.model';
import { Toast } from 'src/renderer/app/models/toasts.model';
import { Actions } from 'src/renderer/app/stores/actions';
import { environmentReducer } from 'src/renderer/app/stores/reducer';
import { environment } from 'src/renderer/environments/environment';
import { Settings } from 'src/shared/models/settings.model';
import { RouteFolder } from '../../../../../commons/dist/cjs/models/routeFolder.model';

export type ViewsNameType =
  | 'ENV_ROUTES'
  | 'ENV_FOLDERS'
  | 'ENV_HEADERS'
  | 'ENV_LOGS'
  | 'ENV_PROXY'
  | 'ENV_SETTINGS';

export type TabsNameType = 'RESPONSE' | 'HEADERS' | 'RULES' | 'SETTINGS';

export type EnvironmentLogsTabsNameType = 'REQUEST' | 'RESPONSE';

export type EnvironmentStatus = {
  running: boolean;
  needRestart: boolean;
};

export type EnvironmentStatusProperties = {
  [T in keyof EnvironmentStatus]?: EnvironmentStatus[T];
};

export type EnvironmentsStatuses = { [key: string]: EnvironmentStatus };

export type DuplicatedRoutesTypes = { [key: string]: Set<string> };

export type UIState = {
  closing: boolean;
};

export type UIStateProperties = { [T in keyof UIState]?: UIState[T] };

export type DuplicateRouteToAnotherEnvironment = {
  moving: boolean;
  routeUUID?: string;
  targetEnvironmentUUID?: string;
};

export type StoreType = {
  activeTab: TabsNameType;
  activeView: ViewsNameType;
  activeFolderUUID: string;
  activeEnvironmentLogsTab: EnvironmentLogsTabsNameType;
  activeEnvironmentUUID: string;
  activeRouteUUID: string;
  activeRouteResponseUUID: string;
  environments: Environments;
  environmentsStatus: EnvironmentsStatuses;
  bodyEditorConfig: any;
  duplicatedRoutes: DuplicatedRoutesTypes;
  environmentsLogs: EnvironmentLogs;
  // the active log UUID per environment
  activeEnvironmentLogsUUID: ActiveEnvironmentsLogUUIDs;
  toasts: Toast[];
  uiState: UIState;
  settings: Settings;
  duplicateRouteToAnotherEnvironment: DuplicateRouteToAnotherEnvironment;
  routesFilter: string;
};

@Injectable({ providedIn: 'root' })
export class Store {
  private store$ = new BehaviorSubject<StoreType>({
    activeView: 'ENV_ROUTES',
    activeTab: 'RESPONSE',
    activeEnvironmentLogsTab: 'REQUEST',
    activeEnvironmentLogsUUID: {},
    activeEnvironmentUUID: null,
    activeRouteUUID: null,
    activeFolderUUID: null,
    activeRouteResponseUUID: null,
    environments: [],
    environmentsStatus: {},
    bodyEditorConfig: {
      options: {
        fontSize: '1rem',
        wrap: 'free',
        showPrintMargin: false,
        tooltipFollowsMouse: false,
        useWorker: false,
        tabSize: INDENT_SIZE
      },
      mode: 'json',
      theme: 'editor-theme'
    },
    duplicatedRoutes: {},
    environmentsLogs: {},
    toasts: [],
    uiState: {
      closing: false
    },
    settings: null,
    duplicateRouteToAnotherEnvironment: { moving: false },
    routesFilter: ''
  });

  constructor() { }

  /**
   * Select store element
   */
  public select<T extends keyof StoreType>(path: T): Observable<StoreType[T]> {
    return this.store$.asObservable().pipe(pluck(path), distinctUntilChanged());
  }

  /**
   * Get any store item
   */
  public get<T extends keyof StoreType>(path: T): StoreType[T] {
    return this.store$.value[path];
  }

  /**
   * Select active environment observable
   */
  public selectActiveEnvironment(): Observable<Environment> {
    return this.store$
      .asObservable()
      .pipe(
        map((store) =>
          store.environments.find(
            (environment) => environment.uuid === store.activeEnvironmentUUID
          )
        )
      );
  }

  /**
   * Select active environment property observable
   */
  public selectActiveEnvironmentProperty<T extends keyof Environment>(
    path: T
  ): Observable<Environment[T]> {
    return this.selectActiveEnvironment().pipe(pluck(path));
  }

  /**
   * Select active environment status observable
   */
  public selectActiveEnvironmentStatus(): Observable<EnvironmentStatus> {
    return this.store$
      .asObservable()
      .pipe(
        map(
          (store: StoreType) =>
            store.environmentsStatus[store.activeEnvironmentUUID]
        )
      );
  }

  /**
   * Select active environment logs
   */
  public selectActiveEnvironmentLogs(): Observable<EnvironmentLog[]> {
    return this.store$
      .asObservable()
      .pipe(
        map((store) => store.environmentsLogs[store.activeEnvironmentUUID])
      );
  }

  /**
   * Select active environment log UUID for selected environment
   */
  public selectActiveEnvironmentLogUUID(): Observable<string> {
    return this.store$
      .asObservable()
      .pipe(
        map(
          (store) =>
            store.activeEnvironmentLogsUUID[store.activeEnvironmentUUID]
        )
      );
  }

  /**
   * Select last environment log for active route response
   */
  public selectActiveRouteResponseLastLog(): Observable<EnvironmentLog> {
    return this.store$
      .asObservable()
      .pipe(
        map((store) =>
          store.activeEnvironmentUUID
            ? store.environmentsLogs[store.activeEnvironmentUUID].find(
              (environmentLog) =>
                environmentLog.routeUUID === store.activeRouteUUID &&
                environmentLog.routeResponseUUID ===
                store.activeRouteResponseUUID
            )
            : null
        )
      );
  }

  /**
   * Select active route observable
   * First look for the top level route. If not found look for routes in folders
   */
  public selectActiveRoute(): Observable<Route> {
    let selectedRoute: Observable<Route>;

    selectedRoute = this.selectActiveEnvironment().pipe(
      map((environment) => {
        if (environment) {
          let selectedRoute = environment.routes.find(
            (route) => route.uuid === this.store$.value.activeRouteUUID)

          // if we cannot find any route in the top level, we look inside environments folders.
          // if a route within a folder is selected, the folder is also selected 
          if (!selectedRoute) {
            selectedRoute = environment.folders
              .find((folder) => folder.uuid === this.store$.value.activeFolderUUID)
              .routes.find((route) => route.uuid === this.store$.value.activeRouteUUID)
            // console.log('selectActiveRoute from folder is called: ', selectedRoute);
          }

          return selectedRoute;
        } else {
          return null
        }
      })
    );

    return selectedRoute;
  }

  /**
   * Select active route response observable
   */
  public selectActiveRouteResponse(): Observable<RouteResponse> {
    return this.selectActiveRoute().pipe(
      map((route) =>
        route
          ? route.responses.find(
            (routeResponse) =>
              routeResponse.uuid === this.store$.value.activeRouteResponseUUID
          )
          : null
      )
    );
  }

  /**
   * Select active route response index observable
   */
  public selectActiveRouteResponseIndex(): Observable<number> {
    return this.selectActiveRoute().pipe(
      map((route) =>
        route
          ? route.responses.findIndex(
            (routeResponse) =>
              routeResponse.uuid === this.store$.value.activeRouteResponseUUID
          ) + 1
          : null
      )
    );
  }

  /**
   * Get environment by uuid
   */
  public getEnvironmentByUUID(UUID: string): Environment {
    return this.store$.value.environments.find(
      (environment) => environment.uuid === UUID
    );
  }

  /**
   * Get active environment value
   */
  public getActiveEnvironment(): Environment {
    return this.store$.value.environments.find(
      (environment) =>
        environment.uuid === this.store$.value.activeEnvironmentUUID
    );
  }

  /**
   * Get environments status value
   */
  public getEnvironmentStatus(): EnvironmentsStatuses {
    return this.store$.value.environmentsStatus;
  }

  /**
   * Get active route value
   */
  public getActiveRoute(): Route {
    const activeEnvironment = this.store$.value.environments.find(
      (environment) =>
        environment.uuid === this.store$.value.activeEnvironmentUUID
    );

    if (!activeEnvironment) {
      return null;
    }

    let activeRoute: Route = activeEnvironment.routes.find(
      (route) => route.uuid === this.store$.value.activeRouteUUID
    );

    // no route found in the top level. Start digging in folders
    // assuming, when the active route within a fodler is selected, this folder is also marked es selected
    if (!activeRoute) {
      activeRoute = activeEnvironment.folders.find((f) => f.uuid === this.store$.value.activeFolderUUID)
        .routes.find((route) => route.uuid === this.store$.value.activeRouteUUID)
    }

    return activeRoute;
  }


  /**
   * Get active folder value
   */
  public getActiveFolder(): RouteFolder {
    const activeEnvironment = this.store$.value.environments.find(
      (environment) => environment.uuid == this.store$.value.activeEnvironmentUUID
    );

    if (!activeEnvironment || !activeEnvironment.folders) {
      return null;
    }

    return activeEnvironment.folders.find(
      (folder) => folder.uuid === this.store$.value.activeFolderUUID
    );
  }

  /**
   * Select active folder observable  TODO: what to do here?
   */
  public selectActiveFolder(): Observable<RouteFolder> {
    return this.selectActiveEnvironment().pipe(
      map((environment) =>
        environment
          ? environment.folders.find(
            (folder) => folder.uuid === this.store$.value.activeFolderUUID
          )
          : null
      )
    );
  }



  /**
   * Get active route response value
   */
  public getActiveRouteResponse(): RouteResponse {
    return this.store$.value.environments
      .find(
        (environment) =>
          environment.uuid === this.store$.value.activeEnvironmentUUID
      )
      .routes.find((route) => route.uuid === this.store$.value.activeRouteUUID)
      .responses.find(
        (response) =>
          response.uuid === this.store$.value.activeRouteResponseUUID
      );
  }

  /**
   * Get route with the supplied UUID from any environment
   */
  public getRouteByUUID(routeUUID: string): Route | undefined {
    let foundRoute: Route;
    this.store$.value.environments.some((environment: Environment) => {
      foundRoute = environment.routes.find(
        (route: Route) => route.uuid === routeUUID
      );

      return !!foundRoute;
    });

    return foundRoute;
  }

  /**
   * Update the store using the reducer
   */
  public update(action: Actions) {
    this.store$.next(environmentReducer(this.store$.value, action));
  }

  /**
   * Get a list with all environment ports
   */
  public getEnvironmentsPorts(): number[] {
    return this.store$.value.environments.reduce((list, env) => {
      list.push(env.port);

      return list;
    }, []);
  }
}
