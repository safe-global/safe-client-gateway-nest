import { TargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';
import { SubmissionNotFoundError } from '@/domain/targeted-messaging/errors/submission-not-found.error';
import { ITargetedMessagingRepository } from '@/domain/targeted-messaging/targeted-messaging.repository.interface';
import { CreateSubmissionDto } from '@/routes/targeted-messaging/entities/create-submission.dto.entity';
import { Submission } from '@/routes/targeted-messaging/entities/submission.entity';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';

@Injectable()
export class TargetedMessagingService {
  constructor(
    @Inject(ITargetedMessagingRepository)
    private readonly repository: ITargetedMessagingRepository,
  ) {}

  async getSubmission(args: {
    outreachId: number;
    chainId: string;
    safeAddress: `0x${string}`;
    signerAddress: `0x${string}`;
  }): Promise<Submission> {
    const targetedSafe = await this.repository.getTargetedSafe(args);
    try {
      const submission = await this.repository.getSubmission({
        chainId: args.chainId,
        targetedSafe,
        signerAddress: args.signerAddress,
      });
      return new Submission(
        submission.outreachId,
        submission.targetedSafeId,
        submission.signerAddress,
        submission.completionDate,
      );
    } catch (err) {
      if (err instanceof SubmissionNotFoundError) {
        return new Submission(
          args.outreachId,
          targetedSafe.id,
          args.signerAddress,
          null,
        );
      } else {
        throw err;
      }
    }
  }

  private async getOrAddSafeToOutreach(args: {
    outreachId: number;
    safeAddress: `0x${string}`;
  }): Promise<TargetedSafe> {
    try {
      return await this.repository.getTargetedSafe(args);
    } catch (err) {
      const outreach = await this.repository.getOutreachOrFail(args.outreachId);

      if (!outreach.targetAll) {
        // Safe is not targeted
        throw err;
      }

      const [targetedSafe] = await this.repository.addSafeToOutreach({
        outreachId: args.outreachId,
        safeAddress: args.safeAddress,
      });

      return targetedSafe;
    }
  }

  async createSubmission(args: {
    outreachId: number;
    chainId: string;
    safeAddress: `0x${string}`;
    signerAddress: `0x${string}`;
    createSubmissionDto: CreateSubmissionDto;
  }): Promise<Submission> {
    const targetedSafe = await this.getOrAddSafeToOutreach(args);
    try {
      await this.repository.getSubmission({
        chainId: args.chainId,
        targetedSafe,
        signerAddress: args.signerAddress,
      });

      throw new BadRequestException('Submission already exists');
    } catch (err) {
      if (err instanceof SubmissionNotFoundError) {
        const submission = await this.repository.createSubmission({
          targetedSafe,
          signerAddress: args.signerAddress,
        });

        return new Submission(
          args.outreachId,
          submission.targetedSafeId,
          submission.signerAddress,
          submission.completionDate,
        );
      } else {
        throw err;
      }
    }
  }
}
