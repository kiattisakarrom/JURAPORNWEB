-- DBA-only recovery. Set channel and reason, inspect the SELECT, then execute the full batch.
-- Never run this merely to take over a channel that another pharmacist is using.
DECLARE @ChannelNo tinyint = 0; -- Replace with the confirmed channel (1-8).
DECLARE @Reason nvarchar(200) = N''; -- Enter the incident reason before running.

IF @ChannelNo NOT BETWEEN 1 AND 8 OR NULLIF(LTRIM(RTRIM(@Reason)),N'') IS NULL
  THROW 51000, 'Provide a channel from 1 to 8 and a recovery reason.', 1;

BEGIN TRANSACTION;
SELECT CLAIM_ID,CHANNEL_NO,CLAIMED_AT,RELEASED_AT
FROM dbo.TBLDISPENSINGCHANNELCLAIMS WITH (UPDLOCK,HOLDLOCK)
WHERE CHANNEL_NO=@ChannelNo AND RELEASED_AT IS NULL;

UPDATE dbo.TBLDISPENSINGCHANNELCLAIMS
SET RELEASED_AT=SYSUTCDATETIME(), RELEASE_REASON=@Reason
WHERE CHANNEL_NO=@ChannelNo AND RELEASED_AT IS NULL;

SELECT CLAIM_ID,CHANNEL_NO,CLAIMED_AT,RELEASED_AT,RELEASE_REASON
FROM dbo.TBLDISPENSINGCHANNELCLAIMS
WHERE CHANNEL_NO=@ChannelNo ORDER BY CLAIMED_AT DESC;
COMMIT TRANSACTION;
