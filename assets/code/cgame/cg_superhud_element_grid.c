#include "cg_local.h"
#include "cg_superhud_private.h"
#include "../qcommon/qcommon.h"

typedef struct
{
	superhudConfig_t config;
	superhudDrawContext_t drawCtx;
} shudElementGridContext;

void* CG_SHUDElementGridCreate(const superhudConfig_t* config)
{
	shudElementGridContext* element;

	SHUD_ELEMENT_INIT(element, config);

	CG_SHUDDrawMakeContext(&element->config, &element->drawCtx);

	return element;
}

void CG_SHUDElementGridRoutine(void* context)
{
	shudElementGridContext* element = (shudElementGridContext*)context;
	int index;
	float x = element->config.rect.value[0];
	float y = element->config.rect.value[1];
	float cellWidth = element->config.rect.value[2];
	float cellHeight = element->config.rect.value[3];
	vec4_t color1, color2;
	float col, row;
	float startCol, startRow;
	superhudCoord_t coord;
	qboolean hasColor2 = element->config.color2.isSet;

	Vector4Copy(element->config.color.value.rgba, color1);
	if (hasColor2)
	{
		Vector4Copy(element->config.color2.value.rgba, color2);
	}

	startCol = x;
	while (startCol > 0)
	{
		startCol -= cellWidth;
	}

	startRow = y;
	while (startRow > 0)
	{
		startRow -= cellHeight;
	}

	index = 0;
	for (col = startCol; col <= 640; col += cellWidth, index++)
	{
		coord.named.x = col;
		coord.named.y = 0;
		coord.named.w = 1;
		coord.named.h = 480;

		if (hasColor2 && (index & 1))
		{
			CG_SHUDFillWithColor(&coord, color2);
		}
		else
		{
			CG_SHUDFillWithColor(&coord, color1);
		}
	}

	index = 0;
	for (row = startRow; row <= 480; row += cellHeight, index++)
	{
		coord.named.x = 0;
		coord.named.y = row;
		coord.named.w = 640;
		coord.named.h = 1;

		if (hasColor2 && (index & 1))
		{
			CG_SHUDFillWithColor(&coord, color2);
		}
		else
		{
			CG_SHUDFillWithColor(&coord, color1);
		}
	}
}

void CG_SHUDElementGridDestroy(void* context)
{
	if (context)
	{
		Z_Free(context);
	}
}



