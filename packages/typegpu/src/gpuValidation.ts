/** WebGPU validation errors are asynchronous and do not necessarily reject mapAsync. */
export async function withGpuValidation<T>(device: Pick<GPUDevice, 'pushErrorScope' | 'popErrorScope'>, operation: () => Promise<T>): Promise<T> {
  device.pushErrorScope('validation');
  let popped = false;
  try {
    const value = await operation();
    popped = true;
    const error = await device.popErrorScope();
    if (error) throw new Error('GPU validation failed');
    return value;
  } finally {
    if (!popped) await device.popErrorScope();
  }
}
