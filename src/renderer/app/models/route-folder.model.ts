import { RouteFolder } from '@mockoon/commons';

export type RouteFolderProperties = { [T in keyof RouteFolder]?: RouteFolder[T] };
