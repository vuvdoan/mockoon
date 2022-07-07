import { Route } from './route.model';

export type RouteFolder = {
  uuid: string;
  routes: Route[];
  folderName: string;
  documentation: string;
  isOpen: boolean;
};
