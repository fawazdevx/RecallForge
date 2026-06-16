// Copyright (c) RecallForge.
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module recallforge::recallforge_tests;

use recallforge::recallforge::{
    Self,
    LearnerProfile,
    SkillCheckpoint,
};
use std::string;
use sui::clock;
use sui::test_scenario as ts;

const LEARNER: address = @0xA11CE;

#[test]
fun records_attempt_then_completes() {
    let mut scenario = ts::begin(LEARNER);
    let clock = clock::create_for_testing(scenario.ctx());

    // Create a profile.
    recallforge::create_profile(string::utf8(b"alice"), &clock, scenario.ctx());

    // Record an attempted checkpoint.
    scenario.next_tx(LEARNER);
    {
        let mut profile = scenario.take_from_sender<LearnerProfile>();
        recallforge::record_checkpoint(
            &mut profile,
            string::utf8(b"linux-privesc/suid"),
            1,
            60,
            recallforge::status_attempted(),
            string::utf8(b"walrus-blob-1"),
            string::utf8(b"chal-1"),
            &clock,
            scenario.ctx(),
        );
        assert!(recallforge::profile_total_points(&profile) == 60, 100);
        assert!(recallforge::profile_completed_count(&profile) == 0, 101);
        scenario.return_to_sender(profile);
    };

    // Promote the checkpoint to completed.
    scenario.next_tx(LEARNER);
    {
        let mut profile = scenario.take_from_sender<LearnerProfile>();
        let mut checkpoint = scenario.take_from_sender<SkillCheckpoint>();
        recallforge::complete_checkpoint(
            &mut checkpoint,
            &mut profile,
            string::utf8(b"walrus-blob-2"),
            &clock,
            scenario.ctx(),
        );
        assert!(recallforge::checkpoint_status(&checkpoint) == recallforge::status_completed(), 102);
        assert!(recallforge::profile_completed_count(&profile) == 1, 103);
        scenario.return_to_sender(checkpoint);
        scenario.return_to_sender(profile);
    };

    clock::destroy_for_testing(clock);
    scenario.end();
}

// abort_code 2 == EEmptyString in recallforge::recallforge
#[test, expected_failure(abort_code = 2)]
fun rejects_empty_handle() {
    let mut scenario = ts::begin(LEARNER);
    let clock = clock::create_for_testing(scenario.ctx());
    recallforge::create_profile(string::utf8(b""), &clock, scenario.ctx());
    clock::destroy_for_testing(clock);
    scenario.end();
}
