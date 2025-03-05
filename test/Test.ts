import assert from "assert";
import { 
  TestHelpers,
  Roasted_DataChanged
} from "generated";
const { MockDb, Roasted } = TestHelpers;

describe("Roasted contract DataChanged event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for Roasted contract DataChanged event
  const event = Roasted.DataChanged.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

  it("Roasted_DataChanged is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await Roasted.DataChanged.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualRoastedDataChanged = mockDbUpdated.entities.Roasted_DataChanged.get(
      `${event.chainId}_${event.block.number}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedRoastedDataChanged: Roasted_DataChanged = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      dataKey: event.params.dataKey,
      dataValue: event.params.dataValue,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualRoastedDataChanged, expectedRoastedDataChanged, "Actual RoastedDataChanged should be the same as the expectedRoastedDataChanged");
  });
});
