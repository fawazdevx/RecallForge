// Copyright (c) RecallForge.
// SPDX-License-Identifier: Apache-2.0

/// RecallForge — persistent cybersecurity learning anchored on Sui.
///
/// This module stores only compact, verifiable references on-chain. The heavy
/// learning memory (session summaries, attempts, reports, roadmaps) lives on
/// Walrus; here we keep a `walrus_ref` (the Walrus blob id) plus the minimal
/// progress state needed to prove skill growth.
///
/// Object model:
/// - `LearnerProfile`  — owned by the learner; aggregate progress + identity.
/// - `SkillCheckpoint` — owned by the learner; one per challenge attempt, with
///                       a Walrus reference to the full report.
/// - `AgentPermission` — owned by the learner; optional, scoped grant that lets
///                       a named agent read/write the learner's memory.
///
/// Security model: every mutating entry function asserts that the transaction
/// sender owns the object it mutates. Because all three objects are *owned*
/// (not shared), Sui already guarantees only the owner can reference them in a
/// transaction; the explicit `owner` assertions are defense-in-depth and make
/// the invariant auditable on-chain.
module recallforge::recallforge;

use std::string::String;
use sui::clock::Clock;
use sui::event;

// ===== Errors =====

/// The transaction sender is not the owner of the object.
const ENotOwner: u64 = 0;
/// A string argument exceeded its maximum allowed length.
const EStringTooLong: u64 = 1;
/// A required string argument was empty.
const EEmptyString: u64 = 2;
/// An unknown checkpoint status value was supplied.
const EInvalidStatus: u64 = 3;
/// The agent permission grant has been revoked.
const EPermissionRevoked: u64 = 4;

// ===== Constants =====

/// Checkpoint statuses.
const STATUS_ATTEMPTED: u8 = 0;
const STATUS_COMPLETED: u8 = 1;

/// Length bounds (in bytes) to keep on-chain state compact and bounded.
const MAX_HANDLE_LEN: u64 = 64;
const MAX_SKILL_LEN: u64 = 96;
const MAX_REF_LEN: u64 = 256;
const MAX_CHALLENGE_ID_LEN: u64 = 128;
const MAX_AGENT_NAME_LEN: u64 = 64;

// ===== Objects =====

/// A learner's identity and aggregate progress. Owned by the learner.
public struct LearnerProfile has key, store {
    id: UID,
    owner: address,
    handle: String,
    total_points: u64,
    completed_count: u64,
    attempted_count: u64,
    created_at_ms: u64,
}

/// A single, verifiable record of a challenge attempt. Owned by the learner.
public struct SkillCheckpoint has key, store {
    id: UID,
    owner: address,
    skill: String,
    level: u8,
    points: u64,
    status: u8,
    /// Walrus blob id holding the full evaluation report / memory artifact.
    walrus_ref: String,
    /// Opaque identifier of the challenge that produced this checkpoint.
    challenge_id: String,
    created_at_ms: u64,
    completed_at_ms: u64,
}

/// An optional, scoped grant allowing a named agent to act on a learner's
/// memory. Owned by the learner; can be revoked at any time.
public struct AgentPermission has key, store {
    id: UID,
    owner: address,
    agent_name: String,
    can_read_memory: bool,
    can_write_memory: bool,
    expires_at_ms: u64,
    revoked: bool,
}

// ===== Events =====

public struct ProfileCreated has copy, drop {
    profile_id: ID,
    owner: address,
    handle: String,
    created_at_ms: u64,
}

public struct CheckpointRecorded has copy, drop {
    checkpoint_id: ID,
    owner: address,
    skill: String,
    level: u8,
    points: u64,
    status: u8,
    walrus_ref: String,
    challenge_id: String,
    created_at_ms: u64,
}

public struct CheckpointCompleted has copy, drop {
    checkpoint_id: ID,
    owner: address,
    skill: String,
    walrus_ref: String,
    completed_at_ms: u64,
}

public struct AgentPermissionGranted has copy, drop {
    permission_id: ID,
    owner: address,
    agent_name: String,
    can_read_memory: bool,
    can_write_memory: bool,
    expires_at_ms: u64,
}

public struct AgentPermissionRevoked has copy, drop {
    permission_id: ID,
    owner: address,
    agent_name: String,
}

// ===== Profile =====

/// Create a `LearnerProfile` and transfer it to the caller.
public entry fun create_profile(handle: String, clock: &Clock, ctx: &mut TxContext) {
    validate_string(&handle, MAX_HANDLE_LEN, true);

    let owner = ctx.sender();
    let now = clock.timestamp_ms();
    let profile = LearnerProfile {
        id: object::new(ctx),
        owner,
        handle,
        total_points: 0,
        completed_count: 0,
        attempted_count: 0,
        created_at_ms: now,
    };

    event::emit(ProfileCreated {
        profile_id: object::id(&profile),
        owner,
        handle: profile.handle,
        created_at_ms: now,
    });

    transfer::transfer(profile, owner);
}

// ===== Checkpoints =====

/// Record a new `SkillCheckpoint` for a challenge attempt, update the owner's
/// aggregate progress on their `LearnerProfile`, and transfer the checkpoint to
/// the owner. `status` must be `STATUS_ATTEMPTED` or `STATUS_COMPLETED`.
public entry fun record_checkpoint(
    profile: &mut LearnerProfile,
    skill: String,
    level: u8,
    points: u64,
    status: u8,
    walrus_ref: String,
    challenge_id: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let owner = ctx.sender();
    assert!(profile.owner == owner, ENotOwner);
    assert!(status == STATUS_ATTEMPTED || status == STATUS_COMPLETED, EInvalidStatus);
    validate_string(&skill, MAX_SKILL_LEN, true);
    validate_string(&walrus_ref, MAX_REF_LEN, true);
    validate_string(&challenge_id, MAX_CHALLENGE_ID_LEN, true);

    let now = clock.timestamp_ms();
    let completed_at_ms = if (status == STATUS_COMPLETED) now else 0;

    let checkpoint = SkillCheckpoint {
        id: object::new(ctx),
        owner,
        skill,
        level,
        points,
        status,
        walrus_ref,
        challenge_id,
        created_at_ms: now,
        completed_at_ms,
    };

    // Update aggregate progress.
    profile.total_points = profile.total_points + points;
    profile.attempted_count = profile.attempted_count + 1;
    if (status == STATUS_COMPLETED) {
        profile.completed_count = profile.completed_count + 1;
    };

    event::emit(CheckpointRecorded {
        checkpoint_id: object::id(&checkpoint),
        owner,
        skill: checkpoint.skill,
        level: checkpoint.level,
        points: checkpoint.points,
        status: checkpoint.status,
        walrus_ref: checkpoint.walrus_ref,
        challenge_id: checkpoint.challenge_id,
        created_at_ms: now,
    });

    transfer::transfer(checkpoint, owner);
}


public entry fun complete_checkpoint(
    checkpoint: &mut SkillCheckpoint,
    profile: &mut LearnerProfile,
    walrus_ref: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let owner = ctx.sender();
    assert!(checkpoint.owner == owner, ENotOwner);
    assert!(profile.owner == owner, ENotOwner);
    validate_string(&walrus_ref, MAX_REF_LEN, true);

    let now = clock.timestamp_ms();
    // Only count the transition into "completed" once.
    if (checkpoint.status != STATUS_COMPLETED) {
        profile.completed_count = profile.completed_count + 1;
    };
    checkpoint.status = STATUS_COMPLETED;
    checkpoint.walrus_ref = walrus_ref;
    checkpoint.completed_at_ms = now;

    event::emit(CheckpointCompleted {
        checkpoint_id: object::id(checkpoint),
        owner,
        skill: checkpoint.skill,
        walrus_ref: checkpoint.walrus_ref,
        completed_at_ms: now,
    });
}

// ===== Agent permissions (optional) =====

/// Grant a named agent scoped access to the caller's memory.
public entry fun grant_agent(
    agent_name: String,
    can_read_memory: bool,
    can_write_memory: bool,
    expires_at_ms: u64,
    ctx: &mut TxContext,
) {
    validate_string(&agent_name, MAX_AGENT_NAME_LEN, true);

    let owner = ctx.sender();
    let permission = AgentPermission {
        id: object::new(ctx),
        owner,
        agent_name,
        can_read_memory,
        can_write_memory,
        expires_at_ms,
        revoked: false,
    };

    event::emit(AgentPermissionGranted {
        permission_id: object::id(&permission),
        owner,
        agent_name: permission.agent_name,
        can_read_memory,
        can_write_memory,
        expires_at_ms,
    });

    transfer::transfer(permission, owner);
}

/// Revoke a previously granted agent permission.
public entry fun revoke_agent(permission: &mut AgentPermission, ctx: &TxContext) {
    assert!(permission.owner == ctx.sender(), ENotOwner);
    assert!(!permission.revoked, EPermissionRevoked);
    permission.revoked = true;

    event::emit(AgentPermissionRevoked {
        permission_id: object::id(permission),
        owner: permission.owner,
        agent_name: permission.agent_name,
    });
}

// ===== Helpers =====

/// Assert a string is non-empty (when required) and within `max_len` bytes.
fun validate_string(s: &String, max_len: u64, required: bool) {
    let len = s.length();
    if (required) {
        assert!(len > 0, EEmptyString);
    };
    assert!(len <= max_len, EStringTooLong);
}

// ===== Read-only accessors (handy for tests / off-chain callers) =====

public fun profile_owner(p: &LearnerProfile): address { p.owner }

public fun profile_total_points(p: &LearnerProfile): u64 { p.total_points }

public fun profile_completed_count(p: &LearnerProfile): u64 { p.completed_count }

public fun checkpoint_status(c: &SkillCheckpoint): u8 { c.status }

public fun checkpoint_walrus_ref(c: &SkillCheckpoint): String { c.walrus_ref }

public fun status_attempted(): u8 { STATUS_ATTEMPTED }

public fun status_completed(): u8 { STATUS_COMPLETED }
