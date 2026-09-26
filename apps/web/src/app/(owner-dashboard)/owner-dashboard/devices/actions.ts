'use server';

import { revokeDeviceById } from '../machines/actions';

export async function revokeOwnerDevice(input: unknown) {
  return revokeDeviceById(input);
}
