import { itemTransitionSchema, orderTransitionSchema, stationSchema, type ItemTransitionInput, type OrderTransitionInput } from "./command-contracts";
import type { StaffRole } from "./order-state";

export type CommandRepository = {
  listCommands(station: "GENERAL" | "KITCHEN" | "BAR"): Promise<unknown[]>;
  transitionOrder(orderId: string, input: OrderTransitionInput, actorStaffId: string, role: StaffRole): Promise<unknown>;
  transitionItem(itemId: string, input: ItemTransitionInput, actorStaffId: string): Promise<unknown>;
};

export class CommandService {
  constructor(private readonly repository: CommandRepository) {}
  list(station: unknown) { return this.repository.listCommands(stationSchema.parse(station)); }
  async transitionOrder(orderId: string, input: unknown, actorStaffId: string, role: StaffRole) { return this.repository.transitionOrder(orderId, orderTransitionSchema.parse(input), actorStaffId, role); }
  async transitionItem(itemId: string, input: unknown, actorStaffId: string) { return this.repository.transitionItem(itemId, itemTransitionSchema.parse(input), actorStaffId); }
}
