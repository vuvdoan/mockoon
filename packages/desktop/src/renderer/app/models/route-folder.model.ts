import { Route, RouteFolder } from '@mockoon/commons';

export type VFolder = {
  children: VFolder[];
  routes: Route[];
  id: string;
  name: string
};
export type RouteFolderProperties = { [T in keyof RouteFolder]?: RouteFolder[T] };

