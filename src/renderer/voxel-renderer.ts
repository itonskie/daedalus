import {
  BoxGeometry,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  HemisphereLight,
  InstancedMesh,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GridReadback, PaletteColor } from "../voxel";
import { GRID_SIZE } from "../voxel";

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface RendererOptions {
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  clearColor?: number;
}

const DEFAULT_CAMERA_POSITION: [number, number, number] = [80, 60, 80];
const DEFAULT_CAMERA_TARGET: [number, number, number] = [32, 20, 32];
const CLEAR_COLOR = 0x0a0a0b;

export class VoxelRenderer {
  private readonly container: HTMLElement;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly controls: OrbitControls;
  private mesh: InstancedMesh | null = null;
  private paletteColors: Color[] = [];
  private cameraSubscribers = new Set<(state: CameraState) => void>();
  private lastEmitted: CameraState | null = null;
  private lastApplied: CameraState | null = null;
  private frameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  constructor(container: HTMLElement, options: RendererOptions = {}) {
    this.container = container;
    this.scene = new Scene();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.camera = new PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(...(options.cameraPosition ?? DEFAULT_CAMERA_POSITION));

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(options.clearColor ?? CLEAR_COLOR);
    container.appendChild(this.renderer.domElement);

    const hemi = new HemisphereLight(0xf4f4f5, 0x26262c, 0.6);
    this.scene.add(hemi);
    const dir = new DirectionalLight(0xffffff, 0.8);
    dir.position.set(50, 80, 30);
    this.scene.add(dir);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(...(options.cameraTarget ?? DEFAULT_CAMERA_TARGET));
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.addEventListener("change", () => this.emitCameraChange());
    this.controls.update();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  setGrid(grid: GridReadback): void {
    this.paletteColors = grid.palette.map((c: PaletteColor) => new Color(c.hex));

    let occupied = 0;
    for (let i = 0; i < grid.cells.length; i++) {
      if (grid.cells[i] !== 0) occupied++;
    }

    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as MeshLambertMaterial).dispose();
      this.mesh = null;
    }

    if (occupied === 0) return;

    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshLambertMaterial({ vertexColors: false });
    const mesh = new InstancedMesh(geometry, material, occupied);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    (mesh as unknown as { userData: { instanceCount: number } }).userData = {
      instanceCount: occupied,
    };

    const dummy = new Object3D();
    let instance = 0;
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const value = grid.cells[x + y * GRID_SIZE + z * GRID_SIZE * GRID_SIZE];
          if (value === 0) continue;
          dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
          dummy.updateMatrix();
          mesh.setMatrixAt(instance, dummy.matrix);
          mesh.setColorAt(instance, this.paletteColors[value - 1]);
          instance++;
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.mesh = mesh;
    this.scene.add(mesh);
  }

  setCamera(state: CameraState): void {
    if (this.lastApplied && sameCamera(state, this.lastApplied)) return;
    this.lastApplied = state;
    this.camera.position.set(...state.position);
    this.controls.target.set(...state.target);
    this.controls.update();
  }

  getCameraState(): CameraState {
    return {
      position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      target: [this.controls.target.x, this.controls.target.y, this.controls.target.z],
    };
  }

  onCameraChange(cb: (state: CameraState) => void): () => void {
    this.cameraSubscribers.add(cb);
    return () => this.cameraSubscribers.delete(cb);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.controls.dispose();
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as MeshLambertMaterial).dispose();
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private emitCameraChange() {
    const state = this.getCameraState();
    if (this.lastEmitted && sameCamera(state, this.lastEmitted)) return;
    this.lastEmitted = state;
    for (const cb of this.cameraSubscribers) cb(state);
  }

  private handleResize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private animate = () => {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}

function sameCamera(a: CameraState, b: CameraState): boolean {
  return (
    a.position[0] === b.position[0] &&
    a.position[1] === b.position[1] &&
    a.position[2] === b.position[2] &&
    a.target[0] === b.target[0] &&
    a.target[1] === b.target[1] &&
    a.target[2] === b.target[2]
  );
}
